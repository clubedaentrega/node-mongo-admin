'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	selector: Object
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	db.collection(body.collection).count(body.selector, function (err, count) {
		if (err) {
			return error(err)
		}
		success({
			count: count
		})
	})
}