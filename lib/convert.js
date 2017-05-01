var pug = require('pug');
var FeedParser = require('feedparser');
var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs','utf8'));

// source the files

module.exports = function(stream,opts,callback){
  var callback = callback;
  var opts = opts;
  if (typeof opts == 'function'){
  	callback = opts;
  	opts = {};
  }

  // convert s from atom feed to a full html page for rendering
  breakDown(stream,function(er,data){
    if (er) {
      return callback(er);
    }
    callback(null,buildUp(data,opts));
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
function buildUp(jsonObj,opts){

  // assign opts to the obj
  jsonObj.opts = opts||{};

  // add some links to the item for avatar et cetera
  jsonObj.items.forEach(function(item){

	// get date
	item.stringDate = isoDateToEnglish(item.date);

	item.content = getH(item,'atom:content');

	// get enclosures
	item.enclosures = [];

	if (item["activity:object"] && item["activity:object"].link){
		
	  
	  if (Array.isArrray(item["activity:object"].link) ){
	      item["activity:object"].link.forEach(parseLink);
	  }else if (typeof item["activity:object"].link == 'object'){
              parseLink(item["activity:object"].link);
	  }else{
              console.log('cannot parse links, is type ' +typeof item["activity:object"].link);
	  }
	  
	  function parseLink(link){
	    if (!link['@']){return;} // avoid keyerror
	    var rel = link['@'].rel;
	    var href = link['@'].href;
	    if (rel == 'enclosure'){
              item.enclosures.push(href);
	    }
	  }
	  
	}

	// get author info

	item.author = {};
	var _author = item.meta['atom:author'];
	if ( item['activity:object'] && item['activity:object'].author){
	  _author = item['activity:object'].author;
	}

	// item.author.name = _author.name.# or empty string
	item.author.name = getH(_author,'name');
	item.author.uri = getH(_author,'uri');
	item.author.fullName = getH(_author,'email');
	item.author.displayName = getH(_author,'poco:displayname');

	var authorLinks = _author.link || [];
	authorLinks.forEach(function(link){// todo: guard against authorLinks not being an array
	  if (!link['@']){return;} // avoid keyerror
	  var rel = link['@'].rel;
	  var href = link['@'].href;
	  if (rel == 'avatar'){
	    item.author.avatar = href;
	  }else if(rel == 'alternate'){
	    item.author.alternate = href;
	  }
	});

  });

  return template(jsonObj);
}


// get obj[key]['#'] or ''
function getH(obj,key){
 if (!obj[key]){return ''}
 return obj[key]['#']||'';
}

function isoDateToEnglish(d){
  var d = d;
  if (typeof d == 'object'){
	d = d.toISOString();
  }

  var dt = d.split(/[t\-]/ig);
  var months = [ "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December" ];

  return months[Number(dt[1])-1] +' '+dt[2]+ ', '+dt[0];
}
