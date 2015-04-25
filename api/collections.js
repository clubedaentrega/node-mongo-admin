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
	var dbNames = Object.keys(dbs).sort()

	async.map(dbNames, function (dbName, done) {
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

			done(null, {
				name: dbName,
				collections: collNames
			})
		})
	}, function (err, connections) {
		if (err) {
			return error(err)
		}

		success({
			connections: connections.filter(Boolean)
		})
	})
}