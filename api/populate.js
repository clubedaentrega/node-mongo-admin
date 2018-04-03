'use strict'

let ObjectId = require('mongodb').ObjectID

module.exports.fields = {
	connection: String,
	collection: String,
	ids: ['id'],
	'path?': String
}

module.exports.handler = function (dbs, body, success, error) {
	let db = dbs[body.connection],
		field = {}

	if (!db) {
		return error(200, 'Invalid connection name')
	}
	if (body.path) {
		field[body.path] = true
	}

	db.collection(body.collection).find({
		_id: {
			$in: body.ids.map(id => new ObjectId(id))
		}
	}, field, (err, cursor) => {
		if (err) {
			return error(err)
		}
		cursor.toArray((err, docs) => {
			if (err) {
				return error(err)
			}
			success({
				docs
			})
		})
	})
}