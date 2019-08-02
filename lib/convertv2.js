var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));
var timeAgo = require('timeago.js');

// TODO try https://www.npmjs.com/package/request-promise-cache for the requests
var request = require('request-promise-cache')

const hour = 3600000;

// get JSON for an AP URL
// TODO make it reject on HTTP 4xx or 5xx
async function apGet(url,ttl) {
    return new Promise(function(resolve,reject){

        request( {
            uri:url,
            cacheKey:url,
            cacheTTL:ttl || 24 * hour,
            headers: {
                "accept": "application/activity+json"
            }
        })
        .then(body=>JSON.parse(body))
        .then(resolve)
        .catch(reject)

    })
    
}

// never rejects, instead it returns an object with a status, error and/or result.
async function apGetNoReject(...args){
    return new Promise(function(resolve,reject){
        apGet(...args)
            .then(res=>resolve({status:true,result:res}))
            .catch(e=>resolve({status:false,error:e}))
    });
}

module.exports = async function (opts) {
    var opts = opts;

    var feedUrl = opts.feedUrl;
    var userUrl = opts.userUrl;
    var isIndex = false;

    if (!userUrl) {
        throw new Error('need user URL');
    }

    var user, feed;

    // get user and feed in parallel if I have both URLs.
    // can cache feed aggressively since it is a specific start and end.
    if (userUrl && feedUrl){
        [user, feed] = await Promise.all([ apGet(userUrl), apGet(feedUrl) ]);
    }else{
        // get user, then outbox, then feed
    
        user = await apGet(userUrl,24 * hour);
        isIndex = true;
        var outbox = await apGet(user.outbox,24 * hour);
        feedUrl = outbox.first;
        feed = await apGet(feedUrl,hour/6);// 10 mins. Because the base feed URL can get new toots quickly.

    }
    
    var templateData = {
        opts: opts,// from the request
        meta: metaForUser(user),
        items: await itemsForFeed(opts,user,feed),
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
async function itemsForFeed(opts,user,feed) {

    var items = feed.orderedItems;
    
    if (opts.boosts){
        // yes, I have to fetch all the fucking boosts for this whole feed apparently >:/
        var boostData = [];
        var boostUrls = feed.orderedItems.filter(i=>i.type=="Announce").map(i=>i.object);
        // console.log(boostUrls);
        boostData = await Promise.all(boostUrls.map(apGetNoReject));
        boostData = boostData.map(d=>d.result||{});

        // now get user data for each of those
        let userData = await Promise.all(boostData.map(d=>d.attributedTo||'').map(apGetNoReject));

        // put a ._userdata key on the item object if this is a boost etc
        for (var i = 0; i < boostData.length; i ++){
            if (userData[i].status){
                boostData[i]._userdata = userData[i].result;
            }
        }

        // some URLs may have failed but IDGAF

        // console.log(boostData[0]);

        boostData.forEach((boostToot)=>{

            if (!boostToot.id){
                return;// case where it's a {} b/c the request failed or w/e
            }
            
            // inject in-place into items

            var index = -1;
            for (var i = 0; i < items.length; i ++){
                if (items[i].object == boostToot.id){
                    index = i;
                    break;
                }
            }

            if (index == -1){
                console.warn("warning: couldn't match boost to item: ",boostToot)
                return;
            }

            boostToot.object = boostToot;// this lets the later stage parser access object without errors :)
            items[i] = boostToot;
        })
    }


    return items.filter((item)=>{
        // this is temporary, don't handle boosts (TODO)
        // return item.type == "Create" && item.object && item.object.type=="Note";
        return typeof item.object == 'object';// handle weird cases
    }).map((item)=>{

        var enclosures = (item.object.attachment||[]).filter((a)=>{
            return a.type == "Document";
        }).map((a)=>{
            return {
                name:a.name,
                type:a.mediaType,
                url:a.url
            }
        });

        var op = item._userdata?item._userdata:user;

        return {
            isBoost:!!item._userdata,
            title:item._userdata?user.preferredUsername+' shared a status by '+op.preferredUsername:'',
            isReply:!!(item.object && item.object.inReplyTo),
            hasCw:item.object.sensitive||false,
            cw:item.object.summary,
            content: item.object&&item.object.content?item.object.content:'',//TODO sanitize then render without entity escapes
            atomHref:item.published?item.published.replace(/\W+/g,''):Math.random().toString().replace('.',''),
            enclosures:enclosures,
            stringDate:item.published?getTimeDisplay(Date.parse(item.published)):'',
            author:{
                uri:op.url,// link to author page
                avatar:op.icon&&op.icon.url?op.icon.url:'',
                displayName:op.name,
                fullName:op.preferredUsername+'@'+(new URL(op.url).hostname),
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
