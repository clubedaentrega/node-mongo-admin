'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	selector: String,
	limit: 'uint',
	'sort?': String
}

module.exports.handler = function (dbs, body, success, error) {
	var db = dbs[body.connection],
		selector, options = {}

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	try {
		selector = JSON.parse(body.selector, reviveJSON)
	} catch (err) {
		return error(201, 'Invalid selector: ' + String(err))
	}

	// Add sort option
	if (body.sort) {
		try {
			options.sort = JSON.parse(body.sort, reviveJSON)
			if (!options.sort) {
				delete options.sort
			}
		} catch (err) {
			return error(202, 'Invalid sort: ' + String(err))
		}
	}

	// Add limit
	if (!body.limit || body.limit > 100) {
		return error(203, 'Invalid limit')
	}
	options.limit = body.limit

	db.collection(body.collection).find(selector, options, function (err, cursor) {
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

function reviveJSON(key, value) {
	if (typeof value === 'string' &&
		value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)) {
		return new Date(value)
	}
	return value
}