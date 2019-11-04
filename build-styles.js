// build the styles
var fs = require('fs');
var sass = require('node-sass');

var staticDir = './static/'
var srcDir = './stylesrc/';
var themes = ['light','dark','auto'];


themes.forEach(function(s){
  var sassFile = srcDir+s+'.scss'
  var cssFile = staticDir+s+'.css'
  var result = sass.renderSync({
    data: fs.readFileSync(sassFile,'utf8'),
    includePaths:[srcDir]
  });

  fs.writeFileSync(cssFile,result.css,'utf8')

});

console.log('ok');
