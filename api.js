/**
 * @file Load *.js files in the api folder and setup express
 * Each file should export:
 *
 * @property {Object} fields The request data format. See validate-fields for details
 *
 * @callback handler
 * @param {Object} dbs A map of mongodb connections (indexed by connection name)
 * @param {Object} body The request body
 * @param {successCallback} success A callback to answer the request with success
 * @param {errorCallback} error A callback to answer the request with error
 */

/**
 * Success and error callbacks:
 *
 * @callback successCallback
 * @param {Object} [response={}] The response object (default fields like 'status' will be put automatically)
 *
 * @callback errorCallback
 * @param {(number|Error)} error An error instance or code (like 101, 200)
 * @param {string} [message=''] The error message
 */
'use strict'

var express = require('express'),
	fs = require('fs'),
	validate = require('validate-fields')(),
	dbs = require('./dbs'),
	json = require('./json')

/**
 * Setup API routes and call done(err, api) when done
 * @param {Function} done
 */
module.exports = function (done) {
	// Connect to mongo
	dbs(function (err, dbs) {
		if (err) {
			return done(err)
		}

		var api = new express.Router()

		api.use(function (req, res, next) {
			if (!req.is('json')) {
				return next(new APIError(101, 'Invalid Content-Type header, application/json was expected'))
			}
			next()
		})

		// JSON parser
		api.use(require('body-parser').json({
			reviver: json.reviver
		}))

		// End points
		fs.readdirSync('./api').forEach(function (item) {
			if (item.substr(-3).toLowerCase() === '.js') {
				processFile('./api/' + item, '/' + item.substr(0, item.length - 3), api, dbs)
			}
		})

		// Error handler
		// next isn't used on purpose, because express demands a 4-arity function
		api.use(function (err, req, res, _) {
			var code, message

			if (err instanceof APIError) {
				code = err.code
				message = err.message
			} else {
				console.log(err.stack)
				code = 100
				message = err.message || 'Unknown error'
			}

			res.json({
				error: {
					code: code,
					message: message
				}
			})
		})

		done(null, api)
	})
}


/**
 * @class
 * @param {number} code
 * @param {string} message
 */
function APIError(code, message) {
	this.code = code
	this.message = message
}

/**
 * Process a file as an api end point
 * @param {string} fileName
 * @param {string} url
 * @param {Express} api
 * @param {Object.<String, Db>} dbs
 * @throws
 */
function processFile(fileName, url, api, dbs) {
	var file = require(fileName),
		fields = validate.parse(file.fields)
	api.post(url, function (req, res, next) {
		// Fields validation
		if (fields.validate(req.body)) {
			next()
		} else {
			next(new APIError(101, fields.lastError))
		}
	}, wrapHandler(file.handler, dbs))
}

/**
 * Return an express middleware for the given API endpoint handler
 * @param {handler} handler
 * @param {Object.<String, Db>} dbs
 * @returns {function}
 */
function wrapHandler(handler, dbs) {
	return function (req, res, next) {
		handler(dbs, req.body, function (response) {
			response = response || {}
			if (typeof response !== 'object') {
				throw new Error('The response must be an object')
			}
			response.error = null
			response = json.stringify(response)
			res.set('Content-Type', 'application/json').send(response)
		}, function (error, msg) {
			next(typeof error === 'number' ? new APIError(error, msg || '') : error)
		})
	}
}