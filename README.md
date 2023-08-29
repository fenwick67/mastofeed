# Mastofeed

Embed a mastodon feed in your blog et cetera.

https://www.mastofeed.com

## User guide

The homepage has a tool for generating iframe code for you, with a sensible `sandbox` attribute.  The feeds fit comfortably in a 400px wide area.

## Deployment

There are several ways to deploy this server.

### Docker

You can deploy the docker image `niccokunzmann/mastofeed`.
Note that the the HTTP server runs on port `8000`.

```
docker run niccokunzmann/mastofeed
```

This is an example `docker-compose.yml` file:

```
version: '3'
services:
  mastofeed:
    image: 'niccokunzmann/mastofeed:latest'
    restart: unless-stopped
    ports:
      - '80:8000'

```

### Heroku

You can deploy the app using Heroku.
You can use the [Heroku git deployment](https://devcenter.heroku.com/articles/git) or
click this button:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## API

### V2

#### GET `/apiv2/feed`

> example: `/api/feed?userurl=https%3A%2F%2Foctodon.social%2Fusers%2Ffenwick67&scale=90&theme=light`

Returns a html page which displays a mastodon feed for a user URL.  Note that URLs must be URI encoded (i.e. `encodeURIComponent('https://octodon.social/users/fenwick67')` ).

Querystring options:

| option | required | description | value | default |
| ------ | -------- | ----------- | ----- | ------- |
| `userurl` | **yes** | Mastodon/ActivityPub account URL  or hashtag URL | `https://${instance}/tags/${tagname}` <br/> `https://${instance}/users/${username}`| |
| `feedurl` | no | a URL to a page of an ActivityPub post collection. Only used for pages beyond the first. |  |  |
| `theme` | no |  `auto` will appear light unless the user sets up dark mode on their device. | either `dark`, `light` or `auto`, to select the UI theme | `dark` |
| `boosts` | no | whether to show boosts or not | `yes` or `no` | `yes` |
| `replies` | no | whether to show replies or not | `yes` or `no` | `yes` |
| `size` | no | the scale of the UI in percent. | e.g. `200` | `100` |
| `header` | no | whether to show the user header (only for users, not hashtags) | `yes` or `no` | `no` |

## Server Installation

This is a straightforward node project with zero
databases or anything. you should just be able to
run `npm install` and then `npm start` to get up and running. 
Set your `PORT` environment variable to change the
port it listens on.

1. install NodeJS and npm
2. install yarn
   ```
   npm -g install yarn
   ```
3. install the packages
   ```
   yarn install
   ```
4. run `npm start`

## Development

If you want automatic reloading of files during development,
you can install `nodemon`:
```
npm install -g nodemon
```
Run it:
```
nodemon index.js --watch lib
```

### Layout

To generate the layout, install `node-sass`.
Then, run
```
node build-styles.js
```

The layout is committed to the repository and only needs building when you change the `.sass` files.

### Docker

To build the docker image:

```
docker build --tag niccokunzmann/mastofeed .
```

You can run the docker image:

```
docker run --rm niccokunzmann/mastofeed
```

## Improve me

Feel free to add a caching layer, improve the styles
and add more features.

## License

MIT License: Copyright 2017 fenwick67
AGPL License: Copyright 2022 Nicco Kunzmann

## Deprecated

### V1 (deprecated, will now just redirect you to the v2 API)

#### GET `/api/feed`

> example: `/api/feed?url=https%3A%2F%2Foctodon.social%2Fusers%2Ffenwick67.atom&scale=90&theme=light`

Returns a html page which displays a mastodon feed for an atom feed URL.  Note that URLs must be URI encoded (i.e. `encodeURIComponent('https://octodon.social/users/fenwick67.atom')` ).

Querystring options:


| option | required | description |
| ------ | -------- | ----------- |
| `url` | **yes** | Mastodon Atom feed URL |
| `theme` | no | either dark, light or auto, to select the UI theme (default is dark). `auto` will appear light unless the user sets up dark mode on their device. |
| `size` | no | the scale of the UI in percent. |


