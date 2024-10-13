const crypto = require('crypto')
const cryptoShit = require('../lib/apCryptoShit.js')

var signature = cryptoShit.sign("hello world")

console.info("signature: %s", signature);
//verify String
var verifierObject = crypto.createVerify("RSA-SHA256");
verifierObject.update("hello world");
var verified = verifierObject.verify({key:cryptoShit.getPublicKey(), padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, signature, "base64");
console.info("is signature ok?: %s", verified);