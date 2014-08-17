/**
 * Convert BSON objects to JSON, as described in
 * http://docs.mongodb.org/manual/reference/mongodb-extended-json/
 */
'use strict'

var mongodb = require('mongodb'),
	ObjectId = mongodb.ObjectID

/**
 * Drop in replacement for JSON.stringify
 * @param {*} value
 * @param {(Function|Array)} [replacer]
 * @param {(string|number)} [space]
 * @returns {string}
 */
module.exports.stringify = function (value, replacer, space) {
	var value2 = preParse(value)
	return JSON.stringify(value2, replacer, space)
}

/**
 * Reviver function used with JSON.parse
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
module.exports.reviver = function (key, value) {
	if (typeof value === 'object' && typeof value.$oid === 'string') {
		return new ObjectId(value.$oid)
	}
	return value
}

/**
 * Return a treated copy of the given value
 */
function preParse(value) {
	var r, key
	if (value instanceof ObjectId) {
		return {
			$oid: value.toHexString()
		}
	} else if (Array.isArray(value)) {
		return value.map(preParse)
	} else if (value && typeof value === 'object' && !value.toJSON) {
		// Simple hash-map
		r = {}
		for (key in value) {
			r[key] = preParse(value[key])
		}
		return r
	} else {
		return value
	}
}