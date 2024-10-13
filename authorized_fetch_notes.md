ok so here's the fucking deal...

https://docs.joinmastodon.org/admin/config/#authorized_fetch

when turned on:

> (...) Mastodon will require HTTP signature authentication on ActivityPub representations of public posts and profiles, which are normally available without any authentication. Profiles will only return barebones technical information when no authentication is supplied.

HTTP signature authentication

> HTTP Signatures is a specification for signing HTTP messages by using a Signature: header with your HTTP request. Mastodon requires the use of HTTP Signatures in order to validate that any activity received was authored by the actor generating it. When secure mode is enabled, all GET requests require HTTP signatures as well.

---

from https://docs.joinmastodon.org/spec/security/#http

> For any HTTP request incoming to Mastodon, the Signature header should be attached:

> Signature: keyId="https://my.example.com/actor#main-key",headers="(request-target) host date",signature="Y2FiYW...IxNGRiZDk4ZA=="

> The three parts of the Signature: header can be broken down like so:

```
Signature:
  keyId="https://my.example.com/actor#main-key",
  headers="(request-target) host date",
  signature="Y2FiYW...IxNGRiZDk4ZA=="
```

> The keyId should correspond to the actor and the key being used to generate the signature, whose value is equal to all parameters in headers concatenated together and signed by the key, then Base64-encoded. See ActivityPub > Public key for more information on actor keys. An example key looks like this:

```json
"publicKey": {
    "id": "https://my.example.com/actor#main-key",
    "owner": "https://my.example.com/actor",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvXc4vkECU2/CeuSo1wtn\nFoim94Ne1jBMYxTZ9wm2YTdJq1oiZKif06I2fOqDzY/4q/S9uccrE9Bkajv1dnkO\nVm31QjWlhVpSKynVxEWjVBO5Ienue8gND0xvHIuXf87o61poqjEoepvsQFElA5ym\novljWGSA/jpj7ozygUZhCXtaS2W5AD5tnBQUpcO0lhItYPYTjnmzcc4y2NbJV8hz\n2s2G8qKv8fyimE23gY1XrPJg+cRF+g4PqFXujjlJ7MihD9oqtLGxbu7o1cifTn3x\nBfIdPythWu5b4cujNsB3m3awJjVmx+MHQ9SugkSIYXV0Ina77cTNS0M2PYiH1PFR\nTwIDAQAB\n-----END PUBLIC KEY-----\n"
 },
```



-------

so for me...

[x] make a key (what kind? RSA SHA256)
[x] reimplement `https://mastodon.social/actor`
[x] sign the headers when making a request (done?)
[ ] test

test by pushing it out and seeing if it works. 

NOTE that you can run a local copy AND the remote copy and do local debugging as long as the keys are the same, the remote server won't care about the actual request comes from!