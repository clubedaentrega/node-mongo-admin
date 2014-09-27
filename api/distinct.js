'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	field: String,
	selector: Object
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	db.collection(body.collection).distinct(body.field, body.selector, function (err, docs) {
		if (err) {
			return error(err)
		}
		success({
			docs: docs
		})
	})
}