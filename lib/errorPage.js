/*
AGPL + MIT License

    Copyright (C) 2022 Nicco Kunzmann

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.


The MIT License:

    Copyright © 2017 fenwick67

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
*/
var ejs = require('ejs');
var fs = require('fs');
var template = ejs.compile(fs.readFileSync('./lib/template.ejs', 'utf8'));

module.exports = function(code,message,displayOptions){

    var msg;
    var displayOptions = displayOptions || {};

    if (code == 500 && !message){
        msg = '<p>Sorry, we are having trouble fetching posts for this user. Please try again later.</p><br><p>If the issue persists, <a href="https://github.com/fenwick67/mastofeed/issues">please open an issue on GitHub</a>, or message fenwick67@octodon.social</p>'
    }else{
        msg = message||'';
    }


    var options = {
        opts:{
            header:true,
            theme:displayOptions.theme||null,
            size:displayOptions.size||null
        },
        meta:{
            title:code.toString(),
            description:msg,
            link:'#'
            // avatar:'',
            // headerImage:''
        },
        items:[],
        nextPageLink:null,
        isIndex:true
    }

    return template(options);
}
