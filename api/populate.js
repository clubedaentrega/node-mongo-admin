'use strict'

var ObjectId = require('mongodb').ObjectID

module.exports.fields = {
	connection: String,
	collection: String,
	ids: ['id'],
	'path?': String
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection],
		field = {}

	if (!db) {
		return error(200, 'Invalid connection name')
	}
	if (body.path) {
		field[body.path] = true
	}

	db.collection(body.collection).find({
		_id: {
			$in: body.ids.map(function (id) {
				return new ObjectId(id)
			})
		}
	}, field, function (err, cursor) {
		if (err) {
			return error(err)
		}
		cursor.toArray(function (err, docs) {
			if (err) {
				return error(err)
			}
			success({
				docs: docs
			})
		})
	})
}