'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	selector: Object,
	limit: 'uint',
	'sort?': Object
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	db.collection(body.collection).find(body.selector, {
		limit: body.limit,
		sort: body.sort
	}, function (err, cursor) {
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