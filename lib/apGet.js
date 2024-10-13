const axios = require('axios')
const NanoCache = require('nano-cache')
const hour = 3600000;
const apCryptoShit = require('./apCryptoShit')

let createAuthzHeader=null;
let createSignatureString=null;

const cache = new NanoCache({
    ttl: 24 * hour
});

cache.on('del',(key)=>{
    // console.log("cache: deleted "+key)
});

// get JSON for an AP URL, by either fetching it or grabbing it from a cache.

// Honestly request-promise-cache should be good enough. Redis would be a nice upgrade but for
// a single process install it will be fine.

// note: rejects on HTTP 4xx or 5xx
module.exports = async function apGet(url,ttl) {

        // fail early
        if (!url){
            throw new Error('URL is invalid');
        }

        var cachedResponse = cache.get(url);
        if (cachedResponse){
            // console.log("cache: hit for "+url)
            return cachedResponse;
        } else {
            // console.log("cache: miss for "+url)
        }

        // import the signature module if we haven't already
        if (!createAuthzHeader || !createSignatureString){
            const module = await import('@digitalbazaar/http-signature-header');
            createAuthzHeader=module.createAuthzHeader;
            createSignatureString=module.createSignatureString;
        }

        let axiosOpts = {
            method:'get',
            url:url,
            headers: {
                "accept": "application/activity+json",
                "User-Agent": "mastofeed.com",
                "date":new Date().toUTCString()
            },
            responseType: 'json',
        };
        
        const includeHeaders = ['(request-target)', 'host', 'date'];
        const plaintext = createSignatureString({
            includeHeaders,
            requestOptions: axiosOpts
        });

        const signature = apCryptoShit.sign(plaintext);
                
        const Authorization = createAuthzHeader({
            includeHeaders,
            keyId: apCryptoShit.getKeyId(),
            signature
        });
        
        axiosOpts.headers.Signature=Authorization;

        let response
        try {
            response = await axios(axiosOpts)
        } catch(e){
            if (e.response){
                throw new Error(`got ${e.response.status} response from server: `+JSON.stringify(e.response.data))
            } else {
                throw e
            }
        }
        // axios would have rejected if we got a 4xx or 5xx or not json
        cache.set(url, response.data, {
            ttl:  ttl || 24 * hour
        });
        return response.data
    
}