'use strict'

const path = require('path')
const debug = require('debug')('hapi-auth-auth0:plugin')
const Boom = require('boom')

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
      const queryStringParams = req.query
      debug('queryStringParams: %j', queryStringParams)
      if (queryStringParams.error && queryStringParams['error_description']) {
        const err = new Error(queryStringParams.error + ': ' + queryStringParams['error_description'])
        debug('error encountered in callback URL: ', err.message)
        if (pluginOptions.error && typeof pluginOptions.error === 'function') {
          debug('error is not null and is a function, invoking')
          const results = pluginOptions.error(err, req, h)
          return results.then ? await results : results
        }
      }
      const code = queryStringParams.code
      debug('code: %s', code)
      debug('destination: %s', destination)
      const userAccessToken = await utility.getUserAccessToken(code)
      debug('userAccessToken: %s', userAccessToken)
      let userInfo = await utility.getUserInfo(userAccessToken)
      debug('userInfo:')
      debug(userInfo)
      if (pluginOptions.transformer && typeof pluginOptions.transformer === 'function') {
        debug('transformer is not null and is a function, invoking')
        const transformerResults = pluginOptions.transformer(userInfo)
        userInfo = transformerResults.then ? await transformerResults : transformerResults
        debug('[transformed] userInfo: %j', userInfo)
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
          const successResults = pluginOptions.success(credentials)
          if (successResults.then) {
            await successResults
          }
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