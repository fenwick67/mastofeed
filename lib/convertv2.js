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

    var items = itemsForFeed(feed);

    var templateData = {
        opts: opts,// from the request
        meta: metaForUser(user),
        items: itemsForFeed(feed),
        nextPageLink: getNextPage(user,feed),
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
function itemsForFeed(feed) {
    return feed.orderedItems.map((item)=>{
        return {
            isBoost:false,
            title:'',
            isReply:!!(item.object && item.object.inReplyTo),
            hasCw:false,
            cw:'',
            atomHref:item.published?item.published.replace(/\W+/g,''):Math.random().toString().replace('.',''),
            enclosures:[],//type, url
            stringDate:item.published?getTimeDisplay(Date.parse(item.published)):'',
            author:{
                uri:'',// link to author page
                avatar:'',// url of av
                fullName:'',// display name
            }
        }
    })
}

// TODO
function getNextPage(user,feed){
    return null;
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
