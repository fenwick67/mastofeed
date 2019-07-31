var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));
var timeAgo = require('timeago.js');
var request = require('request-promise-native')

// get JSON for an AP URL
async function apGet(url) {
    return request.get( {
        uri:url,
        headers: {
            "accept": "application/activity+json"
        },
        transform: function (body) {
            return JSON.parse(body);
        }
    })
}

// accumulate a stream of XML into a html file

module.exports = async function (opts) {
    var opts = opts;

    var feedUrl = opts.feedUrl;
    var userUrl = opts.userUrl;
    var isIndex = false;

    if (!userUrl) {
        throw new Error('need user URL');
    }

    var user = await apGet(userUrl);

    if (userUrl && !feedUrl) {
        isIndex = true;
        var outbox = await apGet(user.outbox);
        feedUrl = outbox.first;

    }

    var feed = await apGet(feedUrl);

    var templateData = {
        opts: opts,// from the request
        meta: metaForUser(user),
        items: itemsForFeed(user,feed),
        nextPageLink: getNextPage(opts,user,feed),
        isIndex: isIndex
    };

    return template(templateData);

}

function metaForUser(user) {
    return {
        avatar: user.icon && user.icon.url?user.icon.url:null,
        headerImage:user.image && user.image.url?user.image.url:null,
        title: user.preferredUsername||null,
        description: user.summary||null
    }
}

// TODO make function
function itemsForFeed(user,feed) {

    return feed.orderedItems.filter((item)=>{
        // this is temporary, don't handle boosts
        return item.type == "Create" && item.object && item.object.type=="Note";
    }).map((item)=>{


        //needs to be { type, url }
        var enclosures = (item.object.attachment||[]).filter((a)=>{
            return a.type == "Document";
        }).map((a)=>{
            return {
                name:a.name,
                type:a.mediaType,
                url:a.url
            }
        });


        return {
            isBoost:false,
            title:'New Status by '+user.preferredUsername,
            isReply:!!(item.object && item.object.inReplyTo),
            hasCw:item.object.sensitive||false,
            cw:item.object.summary,
            content: item.object&&item.object.content?item.object.content:'',//TODO sanitize then render without entity escapes
            atomHref:item.published?item.published.replace(/\W+/g,''):Math.random().toString().replace('.',''),
            enclosures:enclosures,
            stringDate:item.published?getTimeDisplay(Date.parse(item.published)):'',
            author:{
                uri:user.url,// link to author page
                avatar:user.icon&&user.icon.url?user.icon.url:'',
                displayName:user.name,
                fullName:user.preferredUsername+'@'+(new URL(user.url).hostname),
            }
        }
    })
}

// TODO
function getNextPage(opts,user,feed){
    //based on  feed.next
    // take feed.next, uriencode it, then take user url, then take options.mastofeedUrl
    var base = opts.mastofeedUrl.slice(0,opts.mastofeedUrl.indexOf('?'));

    var ret = '/apiv2/feed?userurl=' + encodeURIComponent(opts.userUrl) + '&feedurl=' +encodeURIComponent(feed.next);
    
    // add other params to the end
    (['theme','header','size','boosts','replies']).forEach((k)=>{
        if (typeof opts[k] != 'undefined'){
            ret+=`&${k}=${ opts[k].toString() }`;
        }
    })
    return ret;
}


// utilities below

function getTimeDisplay(d) {
    var d = d;
    if (typeof d !== 'object') {
        d = new Date(d);
    }
    // convert to number
    dt = d.getTime();
    var now = Date.now();

    var delta = now - dt;

    // over 6 days ago
    if (delta > 1000 * 60 * 60 * 24 * 6) {
        return isoDateToEnglish(d.toISOString());
    } else {
        return timeAgo().format(dt);
    }

}

function isoDateToEnglish(d) {

    var dt = d.split(/[t\-]/ig);
    var months = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    return months[Number(dt[1]) - 1] + ' ' + dt[2] + ', ' + dt[0];
}
