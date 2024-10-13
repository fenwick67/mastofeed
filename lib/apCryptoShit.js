const crypto = require('crypto')

// public methods

function getPublicKey(){
    _precheck()
    return _pubKey
}
function getPrivateKey(){
    _precheck()
    return _privKey
}
function getDomainName(){
    _precheck();
    return _domainName;
}
function getKeyId(){
    _precheck();
    return _keyId;
}

function sign(str){
    _precheck()
    var signerObject = crypto.createSign("RSA-SHA256");
    signerObject.update(str);
    return signerObject.sign({key:getPrivateKey(),padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, "base64");
}

function verify(str,signature){
    _precheck();
    var verifierObject = crypto.createVerify("RSA-SHA256");
    verifierObject.update(str);
    var verified = verifierObject.verify({key:_pubKey, padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, signature, "base64");
}

// private
let _precheckOk=false;
let _privKey=""
let _pubKey="";
let _keyId=""
let _domainName=""

function _precheck(){
    if (_precheckOk){return;}
    if (!process.env.AP_PRIVATE_KEY_BASE64 || !process.env.AP_PUBLIC_KEY_BASE64){
        console.error("you dumb shit, set AP_PRIVATE_KEY_BASE64 / AP_PUBLIC_KEY_BASE64 ")
        process.exit(1)
    }
    _pubKey=atob(process.env.AP_PUBLIC_KEY_BASE64);
    _privKey=atob(process.env.AP_PRIVATE_KEY_BASE64);

    // actually check it lol
    var signerObject = crypto.createSign("RSA-SHA256");
    signerObject.update("hello world");
    let signature = signerObject.sign({key:_privKey, padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, "base64");
    var verifierObject = crypto.createVerify("RSA-SHA256");
    verifierObject.update("hello world");
    var verified = verifierObject.verify({key:_pubKey, padding:crypto.constants.RSA_PKCS1_PSS_PADDING}, signature, "base64");
    if (!verified){
        console.error("idk what the fuck you did but the private and public keys dont fucking uhh work???")
        console.error('probably fix your AP_PRIVATE_KEY_BASE64 and AP_PUBLIC_KEY_BASE64')
        process.exit(1)
    }
    _domainName = process.env.DOMAIN_NAME || "mastofeed.com"

    _keyId=`https://${_domainName}/actor#main-key`
    _precheckOk=true;
}

module.exports={sign,verify,getPublicKey,getPrivateKey,getDomainName,getKeyId}