var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));
var timeAgo = require('timeago.js');
const apGet = require('./apGet.js')
const hour = 3600000;
const sanitize = require("sanitize-html")

// like Promise.all except returns null on error instead of failing all the promises
async function promiseSome(proms){

    function noRejectWrap(prom){
        return new Promise(function(resolve,reject){
                
            prom // it's already been called
            .then(resolve)
            .catch(e=>{
                // console.warn(e);// for debugging
                resolve(null)
            })

        })
    }

    return await Promise.all(proms.map(noRejectWrap))

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
        console.log(JSON.stringify(user,null,2))
        if (userNobot(user)){
            throw new Error("this user has #nobot in their profile. Add #yesMastofeed or #mastofeed to your profile if you want to use mastofeed and keep #nobot")
        }
        isIndex = true;
        var outbox = await apGet(user.outbox, 1 * hour);
        
        // outbox.first can be a string for a URL, or an object with stuffs in it
        if (typeof outbox.first == 'object'){
            feed = outbox.first;
        } else {           
            feed = await apGet(outbox.first, hour/6);// 10 mins. Because the base feed URL can get new toots quickly.
        }

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

function userNobot(user){
    let lowerSummary = (user.summary||"").toLowerCase();
    let nobot = lowerSummary.indexOf('nobot') > -1 || lowerSummary.indexOf('nomastofeed') > -1;
    let yesmastofeed = lowerSummary.indexOf('mastofeed') > -1 || lowerSummary.indexOf('yesmastofeed') > -1;
    if (Array.isArray(user.tag)){
        let nobotTag = !!user.tag.find(t=>t.name&&( t.name.toLowerCase()=="#nobot" || t.name.toLowerCase()=="#nomastofeed" ));
        let yesmastofeedTag = !!user.tag.find(t=>t.name&&(t.name.toLowerCase()=="#yesmastofeed" || t.name.toLowerCase()=="#mastofeed"));
        nobot |= nobotTag;
        yesmastofeed |= yesmastofeedTag;
    }
    return nobot && !yesmastofeed;
}

function metaForUser(user) {
    return {
        avatar: user.icon && user.icon.url?user.icon.url:null,
        headerImage:user.image && user.image.url?user.image.url:null,
        title: (user.name||user.preferredUsername) ? sanitize(user.name||user.preferredUsername) : null,
        description: user.summary? sanitize(user.summary):null,
        link:user.url||"#"
    }
}

async function itemsForFeed(opts,user,feed) {

    var items = feed.orderedItems;
    
    if (opts.boosts){
        // yes, I have to fetch all the fucking boosts for this whole feed apparently >:/
        var boostData = [];
        var boostUrls = feed.orderedItems.filter(i=>i.type=="Announce").map(i=>i.object);
        // console.log(boostUrls);
        boostData = await promiseSome(boostUrls.map(url=>apGet(url)));

        // now get user data for each of those
        let userData = await promiseSome(boostData.map(d=>d?d.attributedTo||'':null).map(url=>apGet(url)));

        // put a ._userdata key on the item object if this is a boost
        for (var i = 0; i < boostData.length; i ++){
            if (userData[i] && boostData[i]){
                boostData[i]._userdata = userData[i];
            }
        }

        // some URLs may have failed but IDGAF

        boostData.forEach((boostToot)=>{

            if (!boostToot){// failed request
                return;
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
        return typeof item.object == 'object';// handle weird cases
    }).map((item)=>{

        var enclosures = (item.object.attachment||[]).filter((a)=>{
            return a.type == "Document";
        }).map((a)=>{
            return {
                name:a.name,
                type:a.mediaType || '',
                url:a.url
            }
        });

        var op = item._userdata?item._userdata:user;
        var opFullName;
        try { // this has a try/catch block because new URL can throw lmao
            opFullName = op.preferredUsername+'@'+(new URL(op.url||op.id).hostname)
        } catch(e){
            opFullName=op.preferredUsername||"???";
        }

        return {
            isBoost:!!item._userdata,
            title:sanitize(item._userdata?user.preferredUsername+' shared a status by '+op.preferredUsername:''),
            isReply:!!(item.object && item.object.inReplyTo),
            hasCw:item.object.sensitive||false,
            cw:item.object.summary,
            content: item.object&&item.object.content?sanitize(item.object.content):'',
            atomHref:item.published?item.published.replace(/\W+/g,''):Math.random().toString().replace('.',''),// used for IDs
            enclosures:enclosures,
            stringDate:item.published?getTimeDisplay(Date.parse(item.published)):'',
            permalink:item.object.id?item.object.id:'#',
            author:{
                uri:op.url||op.id||"",// link to author page
                avatar:op.icon&&op.icon.url?op.icon.url:'',
                displayName:op.name || op.preferredUsername,
                fullName:opFullName,
                nobot: userNobot(op)
            }
        }
    }).filter(post=>!post.author.nobot);
}

function getNextPage(opts,user,feed){
    //based on  feed.next
    if (!feed.next){return null}
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
