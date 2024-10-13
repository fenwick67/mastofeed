const crypto = require('crypto')
const cryptoShit = require('../lib/apCryptoShit.js')

var signature = cryptoShit.sign("hello world")

var verified = cryptoShit.verify("hello world", signature)

console.info("is signature ok?: %s", verified);