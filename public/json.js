/**
 * @file Declare some mongo special types, like ObjectId
 */
'use strict'

var json = {}

/**
 * new ObjectId() and ObjectId() both have the same effect
 * @class
 * @param {string} id
 * @property {string} $oid
 */
function ObjectId(id) {
	if (!(this instanceof ObjectId)) {
		return new ObjectId(id)
	}
	if (typeof id !== 'string' || !id.match(/^[0-9a-f]{24}$/i)) {
		throw new Error('Expect id to be a 24-hex-char string')
	}
	this.$oid = id
}

/**
 * Reviver function to use with JSON.parse
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
json.reviver = function (key, value) {
	if (value && typeof value === 'object' && typeof value.$oid === 'string') {
		return new ObjectId(value.$oid)
	}
	return value
}