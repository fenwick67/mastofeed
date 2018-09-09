var pug = require('pug');
var FeedParser = require('feedparser');
var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs','utf8'));
var timeAgo = require('timeago.js');

function isArray(a){
  return Array.isArray(a);
}

// accumulate a stream of XML into a html file

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
    // try and build up
    try{
      var result = buildUp(data,opts)
    }catch(e){
      return callback(e);
    }
    return callback(null,result);
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

  // iterate through the items
  jsonObj.items = jsonObj.items.filter(function(item){

  	// get date
  	item.stringDate = getTimeDisplay(item.date);

  	item.content = getH(item,'atom:content');
    if (!item.content ){// item was deleted
      return false;
    }

    // make anchor tags have the "_top" target
    item.content = item.content.replace(/\<\s*a\s*/ig,'<a target="_top"');

  	// get enclosures
  	item.enclosures = [];

    function findEnclosure(link){
      if (!link['@']){return;} // avoid keyerror
      var rel = link['@'].rel;
      var href = link['@'].href;
      if (rel == 'enclosure'){
        item.enclosures.push({
          url:href,
          type:link['@'].type||''
        });
      }
    }

    // find them in the item's links
    if (item['atom:link']){
      var links = item['atom:link'];
      if (!isArray(links) && typeof links == 'object'){
        links = [links];
      }else if (!isArray(links)){
        links = [];
      }
      links.forEach(findEnclosure);
    }

    // find them in activity:object
    if (item["activity:object"] && item["activity:object"].link){
      var enclosureLinks = item["activity:object"].link;
      if (!isArray(enclosureLinks) && typeof enclosureLinks == 'object'){
        enclosureLinks = [enclosureLinks];
      }else if (!isArray(enclosureLinks)){
        enclosureLinks = [];// not an object or array.
      }
      enclosureLinks.forEach(findEnclosure);
    }


  	// get author info

  	item.author = {};
  	var _author = item.meta['atom:author'];
  	if ( item['activity:object'] && item['activity:object'].author){
  	  _author = item['activity:object'].author;
  	}

  	item.author.name = getH(_author,'name');
  	item.author.uri = getH(_author,'uri');
  	item.author.fullName = getH(_author,'email');
  	item.author.displayName = getH(_author,'poco:displayname')||getH(_author,'poco:preferredUsername')||item.author.name;

  	var authorLinks = _author.link || [];

    if (!isArray(authorLinks) && typeof authorLinks == 'object'){
      authorLinks = [authorLinks];
    }else if ( !isArray(authorLinks) ){
      authorLinks = [];// not an object or string.
    }

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

    // now detect if item is a reply or boost
    item.isBoost = false;//     <activity:verb>http://activitystrea.ms/schema/1.0/share</activity:verb>
    item.isReply = false;

    var v = getH(item,'activity:verb')
    if (v.indexOf('share') > -1){
      item.isBoost = true;
    }

    if (item['thr:in-reply-to']){
      item.isReply = true;
    }

    if(item.categories){
      item.hasCw = item.categories.indexOf('nsfw') > -1;

      if(item.hasCw){
        item.cw = item.summary;
      }
    }

    // get a pagination ID for an entry
    item.paginationId = false;
    if (item['atom:link']){
      var links = item['atom:link'];
      if (!isArray(links) && typeof links == 'object'){
        links = [links];
      }else if (!isArray(links)){
        links = [];
      }
      links.forEach((link)=>{
        if (!link['@']){return}
        if (link['@']['rel']=='self'){
          // parse out the pagination id
          // href looks like this in mastodon: https://octodon.social/users/fenwick67/updates/732275.atom
          // href looks like this in pleroma (and we should ignore): https://social.fenwick.pizza/objects/1e2fa906-378c-43f8-98fa-271aae455758
          var href = link['@']['href'];
          if (!href){return}
          var match = href.match(/\/\d+.atom/);
          if(!match){return}
          var id = match[0].replace(/\D/g,'');
          if (id){
            item.paginationId = id;
          }else{
            return;
          }
        }
      })

    }

    return true;

  });

  if (jsonObj.meta && jsonObj.meta['atom:author'] && jsonObj.meta['atom:author'].link && Array.isArray(jsonObj.meta['atom:author'].link) ){
    jsonObj.meta['atom:author'].link.forEach(link=>{
      var l = link['@'];
      if (l.rel=="header"){
        jsonObj.meta.headerImage = l.href;
      }
      else if(l.rel=="avatar"){
        jsonObj.meta.avatar = l.href;
      }
    });
  }


  // get next page
  jsonObj.feedUrl = opts.feedUrl;
  jsonObj.isIndex = (opts.feedUrl.indexOf('?') == -1);

  // prefer link(rel=next)
  var nextPageFeedUrl = '';
  var links = jsonObj.meta['atom:link'];
  if (links){
    if (!isArray(links) && typeof links == 'object'){
      links = [links];
    }else if (!isArray(links)){
      links = [];
    }
    links.forEach(function(link){
      if (link['@'] && link['@']['rel'] == 'next' && link['@']['href']){
         nextPageFeedUrl = link['@']['href'];
      }
    })
  }

  if (!nextPageFeedUrl){
    // alternative: try to get the oldest entry id on this page
    var lowestId = Infinity;
    jsonObj.items.forEach(function(item){
      var id = Number(item.paginationId);
      if ( id < lowestId ){
        lowestId = id;
      }
    });

    if (lowestId < Infinity && opts.feedUrl){
      nextPageFeedUrl = opts.feedUrl.replace(/\?.+/g,'') + '?max_id='+lowestId;
    }
  }

  if(nextPageFeedUrl){
    jsonObj.nextPageLink = opts.mastofeedUrl.replace(encodeURIComponent(opts.feedUrl),encodeURIComponent(nextPageFeedUrl));
    console.log(jsonObj.nextPageLink);
  }
  return template(jsonObj);
}

// utilities below


// get obj[key]['#'] or ''
function getH(obj,key){
 if (!obj[key]){return ''}
 return obj[key]['#']||'';
}

function getTimeDisplay(d){
  var d = d;
  if (typeof d !== 'object'){
     d = new Date(d);
  }
  // convert to number
  dt = d.getTime();
  var now = Date.now();

  var delta = now - dt;

  // over 6 days ago
  if (delta > 1000*60*60*24*6){
    return isoDateToEnglish(d.toISOString());
  }else{
    return timeAgo().format(dt);
  }

}

function isoDateToEnglish(d){

  var dt = d.split(/[t\-]/ig);
  var months = [ "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December" ];

  return months[Number(dt[1])-1] +' '+dt[2]+ ', '+dt[0];
}
