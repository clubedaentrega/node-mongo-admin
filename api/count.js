'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	selector: Object
}

module.exports.handler = function (dbs, body, success, error) {
	console.log(JSON.stringify({
		op: 'count',
		connection: body.connection,
		collection: body.collection,
		selector: body.selector.__raw
	}))

	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	delete body.selector.__raw

	db.collection(body.collection).count(body.selector, function (err, count) {
		if (err) {
			return error(err)
		}
		success({
			count: count
		})
	})
}