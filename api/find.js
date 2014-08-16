'use strict'

module.exports.fields = {
	collection: String,
	selector: String,
	limit: 'uint',
	sort: String
}

module.exports.handler = function (db, body, success, error) {
	success({
		docs: [
			{
				name: 'Guilherme',
				age: 20
			},
			{
				name: 'John',
				age: 58
			}
		]
	})
}