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
    debug('yar is not registered')
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
      const userAccessToken = await utility.getUserAccessToken(code)
      debug('userAccessToken: %s', userAccessToken)
      let userInfo = await utility.getUserInfo(userAccessToken)
      debug('userInfo:')
      debug(userInfo)
      if (pluginOptions.transformer && typeof pluginOptions.transformer === 'function') {
        debug('transformer is not null and is a function, invoking')
        const transformerResults = pluginOptions.transformer(userInfo, req, h)
        userInfo = transformerResults.then ? await transformerResults : transformerResults
        debug('[transformed] userInfo: %j', userInfo)
      }
      if (pluginOptions.success && typeof pluginOptions.success === 'function') {
        debug('success is not null and is a function, invoking')
        const successResults = pluginOptions.success(userInfo, req, h)
        if (successResults.then) {
          debug('success results are thenable')
          await successResults
          debug('success function returned')
        }
      }
      req.yar.set(pluginOptions.credentialsName, userInfo)
      return h.redirect(pluginOptions.loginSuccessRedirectPath || req.yar.get('destination') || '/')
    }
  })
}

plugin.pkg = require('./package.json')

internals.scheme = function () {
  const _scheme = {}
  _scheme.authenticate = async function (req, h) {
    try {
      debug('[%s] _scheme.authenticate called', req.path)
      if (!req.yar.get('destination')) {
        debug('[%s] destination is not set, setting to %s', req.path, req.path)
        req.yar.set('destination', req.path)
      }
      debug('destination: %s', req.yar.get('destination'))
      const credentials = req.yar.get(pluginOptions.credentialsName)
      if (credentials) {
        debug('[%s] credentials DOES exist', req.path)
        // if (pluginOptions.success && typeof pluginOptions.success === 'function') {
        //   debug('success is not null and is a function, invoking')
        //   const successResults = pluginOptions.success(credentials, req, h)
        //   if (successResults.then) {
        //     debug('success results are thenable')
        //     await successResults
        //     debug('success function returned')
        //   }
        // }
        return h.authenticated({credentials})
      } else {
        debug('[%s] credentials does NOT exist', req.path)
        const response = h.response()
        response.redirect(pluginOptions.auth0.dialogUrl)
        return response.takeover()
      }
    } catch (err) {
      if (pluginOptions.error) {
        pluginOptions.error(err)
      } else {
        return err
      }
      return h.unauthenticated(Boom.unauthorized(err.message))
    }
  }
  return _scheme
}

module.exports = plugin
