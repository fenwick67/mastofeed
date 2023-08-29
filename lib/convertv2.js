/*
AGPL + MIT License

    Copyright (C) 2022 Nicco Kunzmann

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.


The MIT License:

    Copyright © 2017 fenwick67

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
*/
var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));
var timeAgo = require('timeago.js');
//const apGet = require('./apGet.js') // This is declared also as a function below. Which one should be used?
const hour = 3600000;

// get JSON for an AP URL, by either fetching it or grabbing it from a cache.

// Honestly request-promise-cache should be good enough. Redis would be a nice upgrade but for
// a single process install it will be fine.

// note: rejects on HTTP 4xx or 5xx
async function apGet(url,ttl) {
    console.log("apGet: ", url);
    return new Promise(function(resolve,reject){

        // fail early
        if (!url){
            reject(new Error('URL is invalid'));
        }

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
    var isUser = new URL(userUrl).pathname.startsWith("/users/");
    opts.isUser = isUser;

    console.log("opts:", opts);

    if (!userUrl) {
        throw new Error('need user URL');
    }

    var user, feed;
    if (isUser) {
      // get user and feed in parallel if I have both URLs.
      // can cache feed aggressively since it is a specific start and end.
      if (userUrl && feedUrl){
          [user, feed] = await Promise.all([ apGet(userUrl), apGet(feedUrl) ]);
      }else{
          // get user, then outbox, then feed

          user = await apGet(userUrl,24 * hour);
          isIndex = true;
          var outbox = await apGet(user.outbox, 1 * hour);

          // outbox.first can be a string for a URL, or an object with stuffs in it
          if (typeof outbox.first == 'object'){
              feed = outbox.first;
          } else {
              feed = await apGet(outbox.first, hour/6);// 10 mins. Because the base feed URL can get new toots quickly.
          }
      }
    } else {
        feed = await apGet(userUrl, hour/6);
    }

    var templateData = {
        opts: opts,// from the request
        meta: isUser ? metaForUser(user) : null,
        items: await itemsForFeed(opts,user,feed),
        nextPageLink: getNextPage(opts,user,feed),
        isIndex: isIndex
    };

    console.log("templateData", templateData);

    return template(templateData);
}

function metaForUser(user) {
    return {
        avatar: user.icon && user.icon.url?user.icon.url:null,
        headerImage:user.image && user.image.url?user.image.url:null,
        title: user.name||user.preferredUsername||null,
        description: user.summary||null,
        link:user.url||"#"
    }
}

async function itemsForFeed(opts,user,feed) {
    if (feed.totalItems > 0 && typeof feed.orderedItems[0] != 'object') {
        // we only have urls
        feed.orderedItems = (await promiseSome(
            feed.orderedItems.map(function(url){
                // we are getting objects of type note
                return apGet(url, hour).then(
                    note => apGet(note.attributedTo).then(
                       userdata => ({
                           // build an announce object so we are compatible
                           // this is likely to be a case for refatoring
                           _userdata: userdata,
                           type: "Announce",
                           object: note,
                           actor: note.attributedTo,
                           to: note.to,
                           cc: note.cc,
                           published: note.published,
                           id: note.id
                       })
                ));
            })
        )).filter(i => i); // not null if a promise did not resolve
    }

    console.log("feed", feed);
    console.log("feed object", feed.orderedItems[0].object);
    console.log("feed context", feed.orderedItems[0]["@context"]);
    console.log("feed _userdata", feed.orderedItems[0]._userdata);

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

        // console.log(boostData[0]);

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
            boostToot._isBoost = true;
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

        return {
            isBoost:item._isBoost,
            title:item._userdata && user?user.preferredUsername+' shared a status by '+op.preferredUsername:'',
            isReply:!!(item.object && item.object.inReplyTo),
            hasCw:item.object.sensitive||false,
            cw:item.object.summary,
            content: item.object&&item.object.content?item.object.content:'',//TODO sanitize then render without entity escapes
            atomHref:item.published?item.published.replace(/\W+/g,''):Math.random().toString().replace('.',''),// used for IDs
            enclosures:enclosures,
            stringDate:item.published?getTimeDisplay(Date.parse(item.published)):'',
            permalink:item.object.id?item.object.id:'#',
            author:{
                uri:op.url,// link to author page
                avatar:op.icon&&op.icon.url?op.icon.url:'',
                displayName:op.name || op.preferredUsername,
                fullName:op.preferredUsername+'@'+(new URL(op.url).hostname),
            }
        }
    })
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
