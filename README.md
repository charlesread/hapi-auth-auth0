# hapi-auth-auth0

Hapi JS plugin that allows "plug-and-play" Auth0 authentication in Hapi routes.

<!-- toc -->

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
  * [Required Options](#required-options)
  * [Optional Options](#optional-options)

<!-- tocstop -->

<strong>NOTE</strong>:  This README assumes that you know the basics of Auth0's OAuth 2 implementation.  Perhaps I'll add a bit of a tutorial later.

`hapi-auth-auth0` is a typical auth strategy/scheme hapi plugin, meaning that once a user is logged-in their credentials are available in all secured routes via the `request.auth.credentials` object, so you can do _anything_ with that information.  Here's the basic flow when a user requests an endpoint that is secured:

1.  The plugin sees if the user is already authenticated, if they are, they go right to the requested route (with `request.auth.credentials` fully set, BTW).
2. If the user has not already authenticated the user will be redirected to an Auth0 login page, once they log in they will be asked if they give you app permission to use the things that you're asking for (see the `scope` option in the options section below).  If they authorize your app they will be redirected back to the originally requested route in your app.
3. The originally requested route will now have full access, through the `request.auth.credentials` object, to all of the `fields` that you requested access to (see the `fields` option in the options section below).  Simple as that.

## Installation

```bash
npm install --save hapi-auth-auth0
```

## Usage

```js
'use strict'

const Hapi = require('hapi')
const hapuAuthAuth0 = require('hapi-auth-auth0')

const server = Hapi.server({
  host: 'localhost',
  port: 8000
})

!async function () {
  await server.register({
    plugin: hapuAuthAuth0,
    options: {
      domain: '<DOMAIN>',
      client_id: '<CLIENT ID>',
      client_secret: '<CLIENT_SECRET>'
    },
    // optional
    transformer: async function (credentials) {
      const email = credentials.sub.split('|').slice(-1)[0]
      credentials.cn = email.substr(0, email.indexOf('@'))
      return credentials
    },
    // optional
    error: async function(err, request, h) {
      console.error(err.message)
      const response = h.response('<h1>Oh hey, sorry, something went wrong.</h1>')
      return response.takeover()
    }
  })
  server.auth.strategy('auth0', 'auth0')
  await server.route({
    method: 'GET',
    path: '/secure',
    config: {
      auth: 'auth0'
    },
    handler: async function (req, h) {
      // hapi-auth-auth0 will set req.auth.credentials to that which was returned by Auth0
      const credentials = req.auth.credentials
      return credentials
    }
  })
  await server.route({
    method: 'GET',
    path: '/insecure',
    handler: async function (req, h) {
      return '/insecure'
    }
  })
  await server.start()
}()
  .then(function () {
    console.log('Server running at:', server.info.uri)
  })
  .catch(function (err) {
    console.error(err.message)
    console.error(err.stack)
    process.exit(1)
  })
```

## Options

Options exist!

### Required Options

The only "it won't work without them" options are `domain`, `client_id`, and `client_secret`.

### Optional Options

* `scope` - a space-separated list of strings that represent the permissions/scopes that you're asking the user for.  `profile openid email` by default.
* `success` - a function with the signature `[async] function(object)` (where `object` is the information returned from Auth0).  This function is called upon successful authentication with Auth0, so this is useful for things like persisting user information, it does not have any impact on the plugin itself, it's meant for your purposes.
* `transformer` - a function with the signature `[async] function(object)` (where `object` is the information returned from Auth0) that returns the object that you want to become `request.auth.credentials`.  Unlike the function assigned to `success`, the results of this function call _will_ have an impact on the plugin, namely whatever the function returns will be that which is used to create `request.auth.credentials`.
* `error` - a function with signature `[async] function(error, request, h)` that is called if any errors are encountered with the callback that Auth0 calls.  By default the callback URL will respond with a 500 is there is a problem, this function can be used to highjack the response and display whatever you want.
* `handlerPath` - a string that is the endpoint that Auth0 redirects to after successful authentication.  A user will be immediately redirected to the originally requested endpoint, so at most a user might see this URL for a few milliseconds, changing it is merely a cosmetic concern. By default it's a random string.
* `loginSuccessRedirectPath` - a string, by default `hapi-auth-auth0` will redirect to the originally requested route after successful authentication, you can override that here, if you'd like user to be redirected somewhere else, like `/profile`, for example
* `yar` - an object that is passed to [`yar`](https://github.com/hapijs/yar) (the plugin that `hapi-auth-auth0` uses for session management). See [https://github.com/charlesread/hapi-auth-auth0/blob/master/lib/options.js](https://github.com/charlesread/hapi-auth-auth0/blob/master/lib/options.js) for defaults.  Be careful.