/**
 * @file Return all collection names
 */
'use strict'

module.exports.fields = {
	connection: String
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	db.collectionNames({
		namesOnly: true
	}, function (err, names) {
		if (err) {
			return error(err)
		}
		names = names.map(function (name) {
			if (name.indexOf(db.databaseName) === 0) {
				return name.substr(db.databaseName.length + 1)
			}
			return name
		}).sort()
		success({
			collections: names
		})
	})
}