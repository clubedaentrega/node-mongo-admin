'use strict'

/**
 * @typedef {Object<SchemaField>} Schema
 */

/**
 * @typedef {Object} SchemaField
 * @property {?boolean|Array<number>} double - up to 10 values
 * @property {?boolean|Array<string>} string - up to 10 values
 * @property {?boolean} object
 * @property {?boolean} array
 * @property {?boolean} binData
 * @property {?boolean} objectId
 * @property {?boolean} bool
 * @property {?boolean} date
 * @property {?boolean} null
 * @property {?boolean} regex
 * @property {?boolean} timestamp
 * @property {?boolean} long
 * @property {?boolean} minKey
 * @property {?boolean} maxKey
 */

/**
 * @typedef {Object<SchemaNode>} SchemaNode
 * @property {?Object<SchemaNode>} children - children by field name
 */

let mongodb = require('mongodb')

/**
 * @param {mongodb:Collection} collection
 * @param {function(?Error, Schema)} callback
 */
module.exports = function (collection, callback) {
	let schema = {},
		flatSchema = Object.create(null)

	flatSchema[''] = {}

	collection.aggregate([{
		$sample: {
			size: 100
		}
	}]).each((err, doc) => {
		if (err) {
			return callback(err)
		} else if (!doc) {
			return callback(null, flatSchema)
		}

		processObj(doc, schema, '', flatSchema)
	})
}

/**
 * Process a type 'object' value
 * @param {Object} doc
 * @param {SchemaNode} schema
 * @param {string} field
 * @param {Schema} flatSchema
 */
function processObj(obj, schema, field, flatSchema) {
	let hadChildren = true,
		fieldSchema = flatSchema[field]
	fieldSchema.object = true

	// Look for missing fields
	if (!schema.children) {
		schema.children = Object.create(null)
		hadChildren = false
	} else {
		for (let key in schema.children) {
			if (!(key in obj)) {
				let childField = field ? field + '.' + key : key
				flatSchema[childField].null = true
			}
		}
	}

	// Walk fields
	for (let key in obj) {
		let childSchema = schema.children[key],
			childField = field ? field + '.' + key : key,
			childFieldSchema = flatSchema[childField] || (flatSchema[childField] = {})

		if (!childSchema) {
			childSchema = schema.children[key] = {}
			childFieldSchema.null = !hadChildren ? childFieldSchema.null : true
		}

		processValue(obj[key], childSchema, childField, flatSchema)
	}
}

/**
 * Process a type 'array' value
 * @param {Array<*>} arr
 * @param {SchemaNode} schema
 * @param {string} field
 * @param {Schema} flatSchema
 */
function processArray(arr, schema, field, flatSchema) {
	let fieldSchema = flatSchema[field]
	fieldSchema.array = true

	// Look for missing fields
	if (!schema.children) {
		schema.children = Object.create(null)
	} else {
		for (let key in schema.children) {
			let childField = field ? field + '.' + key : key
			flatSchema[childField].null = true
		}
	}

	// Walk values
	arr.forEach(element => {
		processValue(element, schema, field, flatSchema)
	})
}

/**
 * @param {*} value
 * @param {SchemaNode} schema
 * @param {string} field
 * @param {Schema} flatSchema
 */
function processValue(value, schema, field, flatSchema) {
	let fieldSchema = flatSchema[field]

	if (typeof value === 'number') {
		addToEnum(fieldSchema, 'double', value)
	} else if (typeof value === 'string') {
		addToEnum(fieldSchema, 'string', value)
	} else if (value === null) {
		fieldSchema.null = true
	} else if (value instanceof Date) {
		fieldSchema.date = true
	} else if (value instanceof RegExp) {
		fieldSchema.regex = true
	} else if (typeof value === 'boolean') {
		fieldSchema.bool = true
	} else if (value instanceof mongodb.ObjectId) {
		fieldSchema.objectId = true
	} else if (value instanceof mongodb.Binary) {
		fieldSchema.binData = true
	} else if (value instanceof mongodb.Timestamp) {
		fieldSchema.timestamp = true
	} else if (value instanceof mongodb.Long) {
		fieldSchema.long = true
	} else if (value instanceof mongodb.MinKey) {
		fieldSchema.minKey = true
	} else if (value instanceof mongodb.MaxKey) {
		fieldSchema.maxKey = true
	} else if (Array.isArray(value)) {
		processArray(value, schema, field, flatSchema)
	} else if (typeof value === 'object' &&
		Object.getPrototypeOf(value) === Object.prototype) {
		processObj(value, schema, field, flatSchema)
	}
}

/**
 * Handle value enumerations (up to 10)
 * @param {SchemaField} fieldSchema - modified in-place
 * @param {string} typeName
 * @param {number|string} value
 */
function addToEnum(fieldSchema, typeName, value) {
	let type = fieldSchema[typeName]

	if (type === true) {
		// No longer an enum
		return
	} else if (typeof value === 'string' && value.length > 50) {
		// Too large
		fieldSchema[typeName] = true
		return
	} else if (!type) {
		type = fieldSchema[typeName] = []
	}

	if (type.indexOf(value) === -1) {
		type.push(value)
		if (type.length > 10) {
			// Too many values
			fieldSchema[typeName] = true
		}
	}
}