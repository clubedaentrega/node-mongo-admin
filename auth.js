/**
 * @file Create the middleware for basic HTTP auth
 */
'use strict'

var users = require('./config').basicAuth,
	eq = require('constant-equals'),
	validAuths

if (!users) {
	module.exports = function (req, res, next) {
		req.user = {
			user: '',
			password: '',
			connections: undefined
		}
		next()
	}
} else {
	validAuths = users.map(function (each) {
		return 'Basic ' + new Buffer(each.user + ':' + each.password).toString('base64')
	})

	module.exports = function (req, res, next) {
		var index = eq.indexOf(validAuths, req.get('Authorization'))

		if (index === -1) {
			// Ask for authentication
			res.set('WWW-Authenticate', 'Basic realm="mongo-admin"')
			res.status(401).end()
			return
		}

		req.user = users[index]
		next()
	}
}