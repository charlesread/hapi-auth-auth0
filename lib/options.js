'use strict'

const path = require('path')
const deepExtend = require('deep-extend')
const randomize = require('randomatic')

let _options

module.exports = function (server, options) {
  if (_options) {
    return _options
  }
  let defaultOptions
  defaultOptions = {
    domain: '',
    client_id: '',
    client_secret: '',
    scope: 'profile openid email',
    handlerPath: '/' + randomize('Aa', 10),
    loginPath: '/login',
    credentialsName: randomize('Aa', 10),
    yar: {
      name: randomize('Aa', 10),
      storeBlank: false,
      cookieOptions: {
        password: randomize('*', 256),
        isSecure: server.info.protocol === 'https',
        isHttpOnly: true,
        isSameSite: 'Lax'
      }
    },
    appUrl: server.info.uri
  }
  _options = deepExtend({}, defaultOptions, options)
  _options.auth0 = {
    graphUrl: `https://${_options.domain}`,
    dialogUrl: `https://${_options.domain}/login?response_type=code&scope=${_options.scope}&client=${_options.client_id}`
  }
  return _options
}