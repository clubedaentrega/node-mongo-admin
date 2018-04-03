/**
 * @file Return all collection names for each connection
 */
'use strict'

let async = require('async')

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
	let dbNames = Object.keys(dbs).sort()

	async.map(dbNames, (dbName, done) => {
		let db = dbs[dbName]
		db.listCollections().toArray((err, collNames) => {
			if (err) {
				// Ignore errors here
				// A failed connection should not break others
				return done()
			}

			collNames = collNames.map(coll => coll.name).sort()

			done(null, {
				name: dbName,
				collections: collNames
			})
		})
	}, (err, connections) => {
		if (err) {
			return error(err)
		}

		success({
			connections: connections.filter(Boolean)
		})
	})
}