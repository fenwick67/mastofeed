// do a test


var fs = require('fs'),
request = require('request'),
    convert = require('../lib/convert')

	
var r = fs.createReadStream('./test/sample.atom');
	
convert(r,function(er,data){
  if (er){return console.log('error: ',er)}
  console.log('ok');
  fs.writeFileSync('./test/result.html',data,'utf8');
})
