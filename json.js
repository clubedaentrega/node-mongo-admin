/**
 * Convert BSON objects to JSON, as described in
 * http://docs.mongodb.org/manual/reference/mongodb-extended-json/
 */
'use strict'

var mongodb = require('mongodb'),
	ObjectId = mongodb.ObjectID,
	Binary = mongodb.Binary,
	DBRef = mongodb.DBRef,
	MinKey = mongodb.MinKey,
	MaxKey = mongodb.MaxKey,
	Long = mongodb.Long

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
	if (value && typeof value === 'object') {
		if (typeof value.$oid === 'string') {
			return new ObjectId(value.$oid)
		} else if (typeof value.$binary === 'string') {
			return new Binary(new Buffer(value.$binary, 'base64'), value.$type)
		} else if (typeof value.$date === 'number') {
			return new Date(value.$date)
		} else if (typeof value.$regex === 'string') {
			return new RegExp(value.$regex, value.$options)
		} else if (typeof value.$ref === 'string') {
			return new DBRef(value.$ref, module.exports.reviver('', value.$id))
		} else if (value.$undefined === true) {
			return undefined
		} else if (value.$minKey === 1) {
			return new MinKey()
		} else if (value.$maxKey === 1) {
			return new MaxKey()
		} else if (typeof value.$numberLong === 'string') {
			return Long.fromString(value.$numberLong)
		} else if (typeof value.$infinity === 'number') {
			return value.$infinity * Infinity
		} else if (value.$nan === 1) {
			return NaN
		} else {
			return value
		}
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
	} else if (value instanceof Binary) {
		return {
			$binary: value.toString('base64'),
			$type: value.sub_type
		}
	} else if (value instanceof Date) {
		return {
			$date: value.getTime()
		}
	} else if (value instanceof RegExp) {
		return {
			$regex: value.source,
			$options: (value.global ? 'g' : '') + (value.ignoreCase ? 'i' : '') + (value.multiline ? 'm' : '')
		}
	} else if (value instanceof DBRef) {
		return {
			$ref: value.namespace,
			$id: preParse(value.oid)
		}
	} else if (value === undefined) {
		return {
			$undefined: true
		}
	} else if (value instanceof MinKey) {
		return {
			$minKey: 1
		}
	} else if (value instanceof MaxKey) {
		return {
			$maxKey: 1
		}
	} else if (value instanceof Long) {
		if (value.getNumBitsAbs() < 51) {
			return value.toNumber()
		} else {
			return {
				$numberLong: value.toString()
			}
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
	} else if (value === Infinity || value === -Infinity) {
		return {
			$infinity: value === Infinity ? 1 : -1
		}
	} else if (Number.isNaN(value)) {
		return {
			$nan: 1
		}
	} else {
		return value
	}
}