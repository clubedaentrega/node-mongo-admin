'use strict'

let mongodb = require('mongodb'),
	/** @var {Object<{date: new Date, num: number, schema: Object}>} */
	cache = {}

/**
 * @typedef {Object<Sample~SchemaField>} Sample~Schema
 */

/**
 * @typedef {Object} Sample~SchemaField
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
 * @typedef {Object<Sample~SchemaNode>} Sample~SchemaNode
 * @property {?Object<Sample~SchemaNode>} children - children by field name
 */

module.exports.fields = {
	connection: String,
	collection: String
}

module.exports.handler = function (dbs, body, success, error) {
	let db = dbs[body.connection],
		schema = {},
		flatSchema = Object.create(null),
		num = 0,
		answered = false,
		timer

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	let cacheKey = body.connection + '.' + body.collection,
		cached = cache[cacheKey]
	if (cached && cached.date.getTime() > Date.now() - 3600e3) {
		// Cache still fresh
		return success({
			num: cached.num,
			schema: cached.schema
		})
	}

	// Use up to 5s to analyze all data
	timer = setTimeout(answer, 10e3)
	flatSchema[''] = {}

	// Sample 1000 docs from the collection and process them
	// as they come
	let cursor = db.collection(body.collection).aggregate([{
		$sample: {
			size: 1e3
		}
	}])
	cursor.each((err, doc) => {
		if (answered) {
			return
		} else if (err || !doc) {
			return answer()
		}

		num += 1
		processObj(doc, schema, '', flatSchema)
	})

	function answer() {
		if (answered) {
			return
		}
		answered = true

		delete flatSchema['']
		clearTimeout(timer)
		success({
			num: num,
			schema: flatSchema
		})
		cursor.close()
		cache[cacheKey] = {
			date: new Date,
			num: num,
			schema: flatSchema
		}
	}
}

/**
 * Process a type 'object' value
 * @param {Object} doc
 * @param {Sample~SchemaNode} schema
 * @param {string} field
 * @param {Sample~Schema} flatSchema
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
 * @param {Sample~SchemaNode} schema
 * @param {string} field
 * @param {Sample~Schema} flatSchema
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
 * @param {Sample~SchemaNode} schema
 * @param {string} field
 * @param {Sample~Schema} flatSchema
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
 * @param {Sample~SchemaField} fieldSchema - modified in-place
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