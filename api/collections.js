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
		db.collectionNames({
			namesOnly: true
		}, function (err, collNames) {
			if (err) {
				return done(err)
			}
			collNames = collNames.map(function (name) {
				if (name.indexOf(db.databaseName) === 0) {
					return name.substr(db.databaseName.length + 1)
				}
				return name
			}).sort()

			done(null, {
				name: dbName,
				collections: collNames
			})
		})
	}, function (err, result) {
		if (err) {
			return error(err)
		}

		success({
			connections: result
		})
	})
}