/**
 * @file Connect to each mongo db
 */
'use strict'

let config = require('./config'),
	MongoClient = require('mongodb').MongoClient,
	async = require('async')

/**
 * Start all connections, done(err, connections) will be called when done
 * connections is a map connection-name: Db-instance
 * @param {Function} done
 */
module.exports = function (done) {
	let dbs = {}
	async.each(Object.keys(config.connections), (name, done) => {
		let connection = config.connections[name]
		MongoClient.connect(connection.uri, connection.options || {}, (err, db) => {
			dbs[name] = db
			done(err)
		})
	}, err => {
		done(err, dbs)
	})
}