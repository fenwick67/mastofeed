var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));


module.exports = function(code,message){


    var msg;

    if (code == 500 && !message){
        msg = '<p>Sorry, we are having trouble fetching posts for this user. Please try again later.</p><br><p>If the issue persists, <a href="https://github.com/fenwick67/mastofeed/issues">please open an issue on GitHub</a> or message fenwick67@octodon.social</p>'
    }else{
        msg = message;
    }


    var options = {
        opts:{
            header:true
        },
        meta:{
            title:code.toString(),
            description:msg,
            link:'#'
        },
        items:[],
        nextPageLink:null,
        isIndex:true
    }

    return template(options);
}