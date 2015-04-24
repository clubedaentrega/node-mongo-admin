/**
 * @file Return all collection names for each connection
 */
'use strict'

var async = require('async')

module.exports.fields = {}

/*
Output:
{
	connections: [{
		name: String,
		collections: [String]
	}]
}
*/

module.exports.handler = function (dbs, body, success, error) {
	var dbNames = Object.keys(dbs).sort(),
		connections = []

	async.each(dbNames, function (dbName, done) {
		var db = dbs[dbName]
		db.listCollections().toArray(function (err, collNames) {
			if (err) {
				// Ignore errors here
				// A failed connection should not break others
				return done()
			}

			collNames = collNames.map(function (coll) {
				return coll.name
			}).sort()

			connections.push({
				name: dbName,
				collections: collNames
			})
			done()
		})
	}, function (err) {
		if (err) {
			return error(err)
		}

		success({
			connections: connections
		})
	})
}