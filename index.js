'use strict'

var express = require('express'),
	config = require('./config'),
	http = require('http'),
	https = require('https')

require('./api')(function (err, api) {
	if (err) {
		throw err
	}

	// Setup express
	var app = express()
	app.use(require('./auth'))
	app.use('/api', api)
	app.use(express.static('./public'))

	// Start server
	var server = config.https ? https.createServer(config.https, app) : http.createServer(app)
	server.listen(config.port, function () {
		console.log('MongoAdmin listening on http' + (config.https ? 's' : '') + '://localhost:' + config.port)
	})
})