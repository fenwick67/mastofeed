var pug = require('pug');
var FeedParser = require('feedparser');
var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs','utf8'));

// source the files

module.exports = function(stream,callback){
  // convert s from atom feed to a full html page for rendering
  breakDown(stream,function(er,data){
    if (er) {
      return callback(er);
    }
    callback(null,buildUp(data));
  });

}

// break the xml into json
function breakDown(stream,callback){

  var spent = false;
  function cbOnce(er,data){
    if (!spent){
      callback(er,data);
      spent = true;
    }
  }

  stream.on('error',cbOnce);
  var feedparser = new FeedParser();
  feedparser.on('error', cbOnce);
  stream.pipe(feedparser)

  
  feedparser.items = [];
  feedparser.on('readable', function () {
    // This is where the action is!
    var stream = this; // `this` is `feedparser`, which is a stream
    var items = [];
	var item;

    while (item = stream.read()) {
      feedparser.items.push(item);
    }


  });
  
  feedparser.on('end',function(er){cbOnce(null,feedparser)});

}

// hydrate the json to html
function buildUp(jsonObj){
  console.log(jsonObj.meta.title);
  //fs.writeFileSync('sampleobj.json',JSON.stringify(jsonObj,null,2));
  return template(jsonObj);
}
