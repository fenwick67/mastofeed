var Express = require('express');
var convert = require('./lib/convert');
var serveStatic = require('serve-static');
var request = require('request');
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

app.get('/api/feed',function(req,res){

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

app.listen(process.env.PORT || 8000,function(){
	log('listening on '+(process.env.PORT || 8000));
});
