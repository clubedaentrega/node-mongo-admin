/**
 * @file Connect to each mongo db
 */
'use strict'

var config = require('./config'),
	MongoClient = require('mongodb').MongoClient,
	async = require('async')

/**
 * Start all connections, done(err, connections) will be called when done
 * connections is a map connection-name: Db-instance
 * @param {Function} done
 */
module.exports = function (done) {
	var dbs = {}
	async.each(Object.keys(config.connections), function (name, done) {
		var connection = config.connections[name]
		MongoClient.connect(connection.uri, connection.options || {}, function (err, db) {
			dbs[name] = db
			done(err)
		})
	}, function (err) {
		done(err, dbs)
	})
}