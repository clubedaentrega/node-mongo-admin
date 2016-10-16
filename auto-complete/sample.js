'use strict'

/**
 * @typedef {Object} SchemaNode
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
 * @property {?Object<SchemaNode>} children - children by field name
 */

let mongodb = require('mongodb')

/**
 * @param {mongodb:Collection} collection
 * @param {function(?Error, SchemaNode)} callback
 */
module.exports = function (collection, callback) {
	let schema = {}

	collection.aggregate([{
		$sample: {
			size: 100
		}
	}]).each((err, doc) => {
		if (err) {
			return callback(err)
		} else if (!doc) {
			return callback(null, schema)
		}

		processObj(doc, schema)
	})
}

/**
 * Process a type 'object' value
 * @param {Object} doc
 * @param {SchemaNode} schema
 */
function processObj(obj, schema) {
	let hadChildren = true
	schema.object = true

	// Look for missing fields
	if (!schema.children) {
		schema.children = Object.create(null)
		hadChildren = false
	} else {
		for (let key in schema.children) {
			if (!(key in obj)) {
				schema.children[key].null = true
			}
		}
	}

	// Walk fields
	for (let key in obj) {
		let childSchema = schema.children[key]

		if (!childSchema) {
			childSchema = schema.children[key] = !hadChildren ? {} : {
				null: true
			}
		}

		processValue(obj[key], childSchema)
	}
}

/**
 * Process a type 'array' value
 * @param {Array<*>} arr
 * @param {SchemaNode} schema
 */
function processArray(arr, schema) {
	let hadChildren = true
	schema.array = true

	// Look for missing fields
	if (!schema.children) {
		schema.children = Object.create(null)
		hadChildren = false
	} else {
		for (let key in schema.children) {
			if (key !== '$') {
				schema.children[key].null = true
			}
		}
	}

	let childSchema = schema.children.$

	if (!childSchema) {
		childSchema = schema.children.$ = !hadChildren ? {} : {
			null: true
		}
	}

	// Walk values
	arr.forEach(element => {
		processValue(element, childSchema)
	})
}

/**
 * @param {*} value
 * @param {SchemaNode} schema
 */
function processValue(value, schema) {
	if (typeof value === 'number') {
		addToEnum(schema, 'double', value)
	} else if (typeof value === 'string') {
		addToEnum(schema, 'string', value)
	} else if (value === null) {
		schema.null = true
	} else if (value instanceof Date) {
		schema.date = true
	} else if (value instanceof RegExp) {
		schema.regex = true
	} else if (typeof value === 'boolean') {
		schema.bool = true
	} else if (value instanceof mongodb.ObjectId) {
		schema.objectId = true
	} else if (value instanceof mongodb.Binary) {
		schema.binData = true
	} else if (value instanceof mongodb.Timestamp) {
		schema.timestamp = true
	} else if (value instanceof mongodb.Long) {
		schema.long = true
	} else if (value instanceof mongodb.MinKey) {
		schema.minKey = true
	} else if (value instanceof mongodb.MaxKey) {
		schema.maxKey = true
	} else if (Array.isArray(value)) {
		processArray(value, schema)
	} else if (typeof value === 'object' &&
		Object.getPrototypeOf(value) === Object.prototype) {
		processObj(value, schema)
	}
}

/**
 * Handle value enumerations (up to 10)
 * @param {SchemaNode} schema - modified in-place
 * @param {string} typeName
 * @param {number|string} value
 */
function addToEnum(schema, typeName, value) {
	let type = schema[typeName]

	if (type === true) {
		// No longer an enum
		return
	} else if (typeof value === 'string' && value.length > 50) {
		// Too large
		schema[typeName] = true
		return
	} else if (!type) {
		type = schema[typeName] = []
	}

	if (type.indexOf(value) === -1) {
		type.push(value)
		if (type.length > 10) {
			// Too many values
			schema[typeName] = true
		}
	}
}