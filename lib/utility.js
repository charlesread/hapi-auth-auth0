'use strict'

const path = require('path')
const request = require('request')
const debug = require('debug')('hapi-auth-auth0:utility')
const AuthenticationClient = require('auth0').AuthenticationClient

const _options = require(path.join(__dirname, 'options.js'))

module.exports = {

  getUserAccessToken: function (code) {
    debug('getUserAccessToken called')
    debug('code: %s', code)
    debug('url: %s', _options().auth0.graphUrl + '/oauth/token')
    debug('redirect_uri: %s', `${_options().appUrl}${_options().handlerPath}`)
    return new Promise((resolve, reject) => {
      request({
        url: _options().auth0.graphUrl + '/oauth/token',
        method: 'post',
        form: {
          grant_type: 'authorization_code',
          client_id: _options().client_id,
          client_secret: _options().client_secret,
          code,
          redirect_uri: `${_options().appUrl}`
        }
      }, function (err, response, body) {
        if (err) {
          return reject(err)
        }
        debug('body: %j', body)
        body = JSON.parse(body)
        resolve(body.access_token)
      })
    })
  },

  getUserInfo: async function (access_token) {
    const auth0 = new AuthenticationClient({
      domain: _options().domain,
      clientId: _options().client_id
    })
    return await auth0.users.getInfo(access_token)
  }
}
