'use strict'

let express = require('express'),
	config = require('./config'),
	http = require('http'),
	https = require('https'),
	aliases = config.aliases || {}

require('./api')((err, api) => {
	if (err) {
		throw err
	}

	// Setup express
	let app = express()
	app.use(require('./auth'))
	app.use('/api', api)
	app.get('/', (req, res, next) => {
		let regex = /^(\/\?.*?&)(.*?)(&.*)$/,
			match = req.url.match(regex)
		if (match) {
			let connection = decodeURIComponent(match[2])
			if (aliases.hasOwnProperty(connection)) {
				// Redirect to aliases connection
				return res.redirect(301, match[1] + encodeURIComponent(aliases[connection]) + match[3])
			}
		}

		next()
	})
	app.use(express.static('./public'))

	// Start server
	let server = config.https ? https.createServer(config.https, app) : http.createServer(app)
	server.listen(config.port, () => {
		console.log('MongoAdmin listening on http' + (config.https ? 's' : '') + '://localhost:' + config.port)
	})
})