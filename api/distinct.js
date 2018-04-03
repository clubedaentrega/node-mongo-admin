'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	field: String,
	selector: Object
}

module.exports.handler = function (dbs, body, success, error) {
	console.log(JSON.stringify({
		op: 'distinct',
		connection: body.connection,
		collection: body.collection,
		field: body.field,
		selector: body.selector.__raw
	}))

	let db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	delete body.selector.__raw

	db.collection(body.collection).distinct(body.field, body.selector, (err, docs) => {
		if (err) {
			return error(err)
		}
		success({
			docs
		})
	})
}