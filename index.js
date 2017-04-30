var Express = require('express');
var convert = require('./lib/convert');
var serveStatic = require('serve-static');
var request = require('request');

var app = Express();

app.use(serveStatic('static'));

app.get('/api/feed',function(req,res){
	// get feed url
	var feedUrl = req.query.url;
	if (!feedUrl){
		res.status(400);
		res.send('You need to specify a feed URL');
	}
	
	var opts = {};
		
	var req = request.get(feedUrl);
	convert(req,{},function(er,data){
		if (er){
			res.status(500);
			res.send('error fetching or parsing feed');
		}
		res.status(200);
		res.send(data);
	});
	
});

app.listen(process.env.PORT || 8000,function(){
	console.log('listening on '+(process.env.PORT || 8000));
});
