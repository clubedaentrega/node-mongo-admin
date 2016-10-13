'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	selector: Object,
	limit: 'uint',
	skip: 'uint',
	'sort={}': Object
}

module.exports.handler = function (dbs, body, success, error) {
	console.log(JSON.stringify({
		op: 'find',
		connection: body.connection,
		collection: body.collection,
		selector: body.selector.__raw,
		limit: body.limit,
		skip: body.skip,
		sort: body.sort.__raw
	}))

	var db = dbs[body.connection]

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	delete body.selector.__raw
	delete body.sort.__raw

	db.collection(body.collection).find(body.selector, {
		limit: body.limit,
		skip: body.skip,
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