/**
 * @file Create the middleware for basic HTTP auth
 */
'use strict'

var config = require('./config').basicAuth,
	expected

if (!config) {
	module.exports = function (req, res, next) {
		next()
	}
} else {
	expected = 'Basic ' + new Buffer(config.user + ':' + config.password).toString('base64')
	module.exports = function (req, res, next) {
		if (req.get('Authorization') !== expected) {
			// Ask for authentication
			res.set('WWW-Authenticate', 'Basic realm="mongo-admin"')
			res.status(401).end()
			return
		}

		next()
	}
}