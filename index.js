var Express = require('express');
// v1 api
var convert = require('./lib/convert');
// v2 api
var convertv2 = require('./lib/convertv2');
var serveStatic = require('serve-static');
var request = require('request');
var cors = require('cors');
var errorPage = require('./lib/errorPage');
var morgan = require('morgan');

var app = Express();

var logger = morgan(':method :url :status via :referrer - :response-time ms') 

app.use(
	serveStatic('static',{
		maxAge:'1d'
	})
);

function doCache(res,durationSecs){
	res.set({
		"Cache-Control":"max-age="+durationSecs
	})
}

// web.site:another.one.here => [ /web\.site/i , /another\.one/i ]
var blocklist = [];
if (process.env["BLOCKLIST"]){
	blocklist = process.env["BLOCKLIST"].split(':').map((s)=>{
		var dotsFixed = s.replace(/\./gi,'\\.');
		return new RegExp(dotsFixed, 'i');
	});
}

// this just redirects to the 
app.options('/api/feed',cors());
app.get('/api/feed',cors(),logger,function(req,res){

	// get feed url
	var feedUrl = req.query.url;
	if (!feedUrl){
		res.status(400);
		res.send(errorPage(400,'You need to specify a feed URL'));
		return;
	}

	var userUrl = feedUrl.replace(/\.atom.*/i,'');

	var redirectUrl = '/apiv2/feed?';
	var qs = ['userurl='+encodeURIComponent(userUrl),"api=v1"];

	(['size','theme','boosts','replies']).forEach(key=>{
		if (typeof req.query[key] != 'undefined'){
			qs.push(key+'='+encodeURIComponent(req.query[key]));
		}
	})

	res.redirect(redirectUrl + qs.join('&'));

});

app.options('/apiv2/feed',cors());
// http://localhost:8000/apiv2/feed?userurl=https%3A%2F%2Foctodon.social%2Fusers%2Ffenwick67
app.get('/apiv2/feed',cors(),logger,function(req,res){
	
	// get feed url
	var userUrl = req.query.userurl;
	if (!userUrl){
		res.status(400);
		res.send(errorPage(400,'You need to specify a user URL'));
		return;
	}
	var feedUrl = req.query.feedurl;

	var opts = {};
	if (req.query.size){
		opts.size = req.query.size;
	}
	if (req.query.theme){
		opts.theme = req.query.theme;
	}
	if (req.query.header){
		if (req.query.header.toLowerCase() == 'no' || req.query.header.toLowerCase() == 'false'){
			opts.header = false;
		}else{
			opts.header = true;
		}
	}

	opts.boosts = true;
	if (req.query.boosts){
		if (req.query.boosts.toLowerCase() == 'no' || req.query.boosts.toLowerCase() == 'false'){
			opts.boosts = false;
		}else{
			opts.boosts = true;
		}
	}

	opts.replies = true;
	if (req.query.replies){
		if (req.query.replies.toLowerCase() == 'no' || req.query.replies.toLowerCase() == 'false'){
			opts.replies = false;
		}else{
			opts.replies = true;
		}
	}
	opts.userUrl = userUrl;
	opts.feedUrl = feedUrl;
	opts.mastofeedUrl = req.url;

	var blocked = false;

	function fakeFail(){
		var t = 1000 + 1000 * Math.random() * Math.random();
		blocked = true;
		setTimeout(function(){
			res.status(500);
			res.send(errorPage(500,null,{theme:opts.theme,size:opts.size}));
		},t);
	}

	// shall I block the user?
	var base = new URL(userUrl).hostname;
	for (var i = 0; i < blocklist.length; i++){
		var re = blocklist[i];
		if (re.test(base)){
			fakeFail();
			console.log("blocked domain: "+base+" (matches "+re.source+")");
			return; // need to exit this function so feed isn't actually fetched
		}
	}

	// block by referer
	var ref = req.get("referer")
	if (ref){
		for (var i = 0; i < blocklist.length; i++){
			var re = blocklist[i];
			if (re.test(ref)){
				fakeFail();
				console.log("blocked domain via referer: "+base+" (matches "+re.source+")");
				return; // need to exit this function so feed isn't actually fetched
			}
		}
	}

	if (!blocked){
		
		convertv2(opts).then((data)=>{
			res.status(200);
			doCache(res,60*60);
			res.send(data);
		}).catch((er)=>{
			res.status(500);
			res.send(errorPage(500,null,{theme:opts.theme,size:opts.size}));
			// TODO log the error
			console.error(er,er.stack);
		})

	}
})

app.listen(process.env.PORT || 8000,function(){
	console.log('Server started, listening on '+(process.env.PORT || 8000));
});
