var Express = require('express');
// v1 api
var convert = require('./lib/convert');
// v2 api
var convertv2 = require('./lib/convertv2');
var serveStatic = require('serve-static');
var request = require('request');
var cors = require('cors');
var log = console.log;

var app = Express();

function logMiddleware(req,res,next){
	log(req.method.toUpperCase() +' '+ req.url);
	log( '\t'+ new Date().toISOString() );
	if(req.headers && req.headers.referer){
		log('\tReferer: '+req.headers.referer);
	}
	return next(null);
}

app.use(logMiddleware);

app.use(
	serveStatic('static',{
		maxAge:'1d'
	})
);

app.options('/api/feed',cors());
app.get('/api/feed',cors(),function(req,res){

	// get feed url
	var feedUrl = req.query.url;
	if (!feedUrl){
		res.status(400);
		res.send('You need to specify a feed URL');
	}

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
	opts.feedUrl = feedUrl;
	opts.mastofeedUrl = req.url;

	var req = request.get(feedUrl);
	convert(req,opts,function(er,data){
		if (er){
			res.status(500);
			return res.send('Error fetching or parsing your feed.');
		}
		res.status(200);
		res.send(data);
	});

});

app.options('/apiv2/feed',cors());
// http://localhost:8000/apiv2/feed?userurl=https%3A%2F%2Foctodon.social%2Fusers%2Ffenwick67
app.get('/apiv2/feed',cors(),function(req,res){
	
	// get feed url
	var userUrl = req.query.userurl;
	if (!userUrl){
		res.status(400);
		res.send('You need to specify a user URL');
	}

	var feedUrl = req.query.feedUrl;

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

	convertv2(opts).then((data)=>{
		res.status(200);
		res.send(data);
	}).catch((er)=>{
		res.status(500);
		res.send('Error fetching or parsing your feed.');
		// TODO log the error
		console.error(er);
	})
})

app.listen(process.env.PORT || 8000,function(){
	log('listening on '+(process.env.PORT || 8000));
});
