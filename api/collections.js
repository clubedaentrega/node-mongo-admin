/**
 * @file Return all collection names
 */
'use strict'

module.exports.fields = {}

module.exports.handler = function (db, body, success, error) {
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
		})
		success({
			collections: names
		})
	})
}