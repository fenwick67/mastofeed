
const crypto = require('crypto')
const cryptoShit = require('../lib/apCryptoShit.js')

crypto.generateKeyPair('rsa', {
    modulusLength: 1024,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
}, (err, pub, priv)=>{
    if (err){
        console.error(err);
        process.exit(1);
    }
    console.log('your public key (base64), set AP_PUBLIC_KEY_BASE64 in your environment :\n'+btoa(pub));
    console.log('your private key (base64), set AP_PRIVATE_KEY_BASE64 in your environment:\n'+btoa(priv));

    process.env.AP_PRIVATE_KEY_BASE64=btoa(priv);
    process.env.AP_PUBLIC_KEY_BASE64=btoa(pub);

    var signature = cryptoShit.sign("hello world")
    var verifierObject = crypto.createVerify("RSA-SHA256");
    verifierObject.update("hello world");
    var verified = verifierObject.verify({key:pub, padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, signature, "base64");

    if (verified){
        process.exit(0);
    }
    else {
        console.error("FUCK IT DIDNT WORK OH GOD")
        process.exit(1)
    }
});