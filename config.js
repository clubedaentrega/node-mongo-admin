'use strict'

module.exports = {
	// The port the http will listen to
	port: 8000,
	mongoUri: 'mongodb://localhost:27017/backuper',
	// HTTP basic auth, leave null to turn off
	basicAuth: {
		user: 'admin',
		password: 'pass'
	}
}