'use strict'

var fs = require('fs')

module.exports = {
	// The port the http will listen to
	port: 8000,
	mongoUri: 'mongodb://localhost:27017/backuper',
	// HTTP basic auth, leave null to turn off
	// NOTE: basic HTTP auth is almost useless with https!
	basicAuth: {
		user: 'admin',
		password: 'pass' // CHANGE IT!
	},
	// https options, for more details see:
	// http://nodejs.org/api/tls.html#tls_tls_createserver_options_secureconnectionlistener
	// Leave null to use http, not https
	// Is strongly recommended to use https+basic-auth
	https: {
		// NOTE: do not use the default private key, since is was made public!
		// The default is set just as an example and should never be used in production
		key: fs.readFileSync('./keys/example-key.pem'), // CHANGE IT!
		cert: fs.readFileSync('./keys/example-cert.pem') // CHANGE IT!
	}
}