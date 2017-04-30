# Mastofeed

Embed a mastodon feed in your blog et cetera.

Preview (note: domain name incoming): https://mastofeed.herokuapp.com/

## User guide

The homepage has a tool for generating iframe code for you, with a sensible `sandbox` attribute.  The feeds fit comfortably in a 400px wide area.

## API

### GET `/api/feed`

> example: `/api/feed?url=https%3A%2F%2Foctodon.social%2Fusers%2Ffenwick67.atom&scale=90&theme=light`

Returns a html page which displays a mastodon feed for an atom feed URL.  Note that URLs must be URI encoded (i.e. `encodeURIComponent('https://octodon.social/users/fenwick67.atom')` ).

Querystring options:


| option | required | description |
| ------ | -------- | ----------- |
| `url` | **yes** | Mastodon Atom feed URL |
| `style` | no | either `dark` or `light`, to select the UI theme (default is `dark`). |
| `size` | no | the scale of the UI in percent. |

## Server Installation

This is a straightforward node project with zero databases or anything, you should just be able to run `npm install` and then `npm start` to get up and running.  Set your `PORT` environment variable to change the port it listens on.

## Improve me

Feel free to add a chaching layer, improve the styles and add more features.
