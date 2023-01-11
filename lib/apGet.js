const axios = require('axios')
const NanoCache = require('nano-cache')
const hour = 3600000;

const cache = new NanoCache({
    ttl: 24 * hour
});

cache.on('del',key=>console.log(key,'deleted'))

// get JSON for an AP URL, by either fetching it or grabbing it from a cache.

// Honestly request-promise-cache should be good enough. Redis would be a nice upgrade but for
// a single process install it will be fine.

// note: rejects on HTTP 4xx or 5xx
module.exports = async function apGet(url,ttl) {
    
    return new Promise(function(resolve,reject){

        // fail early
        if (!url){
            return reject(new Error('URL is invalid'));
        }

        var cachedResponse = cache.get(url);
        if (cachedResponse){
            return resolve(cachedResponse);
        }

        axios( {
            method:'get',
            url:url,
            headers: {
                "accept": "application/activity+json",
                "User-Agent": "mastofeed.com"
            },
            responseType: 'json',

        })
        .then((response)=>{
            // axios would have rejected if we got a 4xx or 5xx or not json
            cache.set(url, response.data, {
                ttl:  ttl || 24 * hour
            });
            return response.data
        })
        .then(resolve)
        .catch(reject)

    })

    
}