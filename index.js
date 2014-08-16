'use strict'

var express = require('express'),
	config = require('./config'),
	http = require('http')

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
	http.createServer(app).listen(config.port, function () {
		console.log('MongoAdmin listening on port ' + config.port)
	})
})