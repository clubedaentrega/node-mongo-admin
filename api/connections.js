/**
 * @file Return all connection names
 */
'use strict'

module.exports.fields = {}

module.exports.handler = function (dbs, body, success) {
	success({
		connections: Object.keys(dbs)
	})
}