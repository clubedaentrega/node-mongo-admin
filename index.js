'use strict'

let express = require('express'),
	config = require('./config'),
	http = require('http'),
	https = require('https')

require('./api')((err, api) => {
	if (err) {
		throw err
	}

	// Setup express
	let app = express()
	app.use(require('./auth'))
	app.use('/api', api)
	app.use(express.static('./public'))

	// Start server
	let server = config.https ? https.createServer(config.https, app) : http.createServer(app)
	server.listen(config.port, () => {
		console.log('MongoAdmin listening on http' + (config.https ? 's' : '') + '://localhost:' + config.port)
	})
})