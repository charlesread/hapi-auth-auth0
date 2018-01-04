'use strict'

const path = require('path')
const debug = require('debug')('hapi-auth-auth0:plugin')
const Boom = require('boom')
const type = require('type-detect')

const _options = require(path.join(__dirname, 'lib', 'options.js'))
const utility = require(path.join(__dirname, 'lib', 'utility.js'))

let pluginOptions

const internals = {}

const plugin = {}

plugin.register = async function (server, options) {
  pluginOptions = _options(server, options)
  debug('plugin registered')
  debug('pluginOptions: %j', pluginOptions)
  server.ext('onRequest', function (req, h) {
    debug('received request for %s [%s]', req.path, req.method)
    return h.continue
  })
  server.auth.scheme('auth0', internals.scheme)
  if (!server.registrations['yar']) {
    await server.register({
      plugin: require('yar'),
      options: pluginOptions.yar
    })
  }
  server.route({
    method: 'get',
    path: pluginOptions.loginPath,
    handler: async function (req, h) {
      return h.redirect(pluginOptions.auth0.dialogUrl)
    }
  })
  server.route({
    method: 'get',
    path: pluginOptions.handlerPath,
    handler: async function (req, h) {
      const destination = req.yar.get('destination')
      debug('code: %s', req.query.code)
      debug('destination: %s', destination)
      const userAccessToken = await utility.getUserAccessToken(req.query.code)
      debug('userAccessToken: %s', userAccessToken)
      let userInfo = await utility.getUserInfo(userAccessToken)
      debug('userInfo:')
      debug(userInfo)
      if (type(pluginOptions.transformer) === 'function') {
        debug('transformer is not null and is a function')
        const transformerResults = pluginOptions.transformer(userInfo)
        if (transformerResults.then) {
          userInfo = await transformerResults
        } else {
          userInfo = transformerResults
        }
      }
      req.yar.set(pluginOptions.credentialsName, userInfo)
      return h.redirect(pluginOptions.loginSuccessRedirectPath || destination || '/')
    }
  })
}

plugin.pkg = require('./package.json')

internals.scheme = function () {
  const _scheme = {}
  _scheme.authenticate = async function (req, h) {
    try {
      debug('_scheme.authenticate called')
      if (!req.yar.get('destination')) {
        debug('destination is not set, setting to req.path')
        req.yar.set('destination', req.path)
      }
      debug('destination: %s', req.yar.get('destination'))
      const credentials = req.yar.get(pluginOptions.credentialsName)
      if (credentials) {
        if (pluginOptions.success && typeof pluginOptions.success === 'function') {
          pluginOptions.success(credentials)
        }
        debug('credentials does exist')
        return h.authenticated({credentials})
      } else {
        debug('credentials does not exist, redirecting to Auth0 for auth')
        const response = h.response()
        response.redirect(pluginOptions.auth0.dialogUrl)
        return response.takeover()
      }
    } catch (err) {
      if (pluginOptions.error) {
        pluginOptions.error(err)
      } else {
        console.error(err.message)
      }
      return h.unauthenticated(Boom.unauthorized(err.message))
    }
  }
  return _scheme
}

module.exports = plugin