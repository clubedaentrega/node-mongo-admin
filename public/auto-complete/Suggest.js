/*global NGram*/
'use strict'

/**
 * @typedef {Object} Suggest~Result
 * @property {string} text - display text
 * @property {Object} data - used by replacer
 */

let Suggest = {}

/**
 * Make suggestions based on the cursor position and schema definition
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @returns {Array<Suggest~Result>}
 */
Suggest.getSuggestions = function (parsed, schema) {
	if (parsed.type !== 'object') {
		return []
	}
	return Suggest._processCursorInFind(parsed, schema, '')
}

/*
 * The mongodb query structure is depicted bellow:
 * 
 * {name: {$ne: 'John'}}
 * ^      ^     ^
 * |      |     +- value
 * |      +- field expression
 * +- find
 * 
 * Each context have different suggestion mechanisms.
 * For example, in the find context fields are suggested,
 * while in the field expression context operators are suggested
 */

/**
 * Process cursor in a find construction
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @returns {Array<Suggest~Result>}
 * @private
 */
Suggest._processCursorInFind = function (parsed, schema, prefix) {
	let keys = parsed.properties.map(prop => prop.key)

	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestFields('', schema, prefix, keys)
	}

	let property = parsed.properties[parsed.cursor],
		subPrefix = prefix ? prefix + '.' + property.key : property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		let search = property.key.slice(0, property.keyCursor)
		return Suggest._suggestFields(search, schema, prefix, keys)
	} else if (property.key === '$or' || property.key === '$and' || property.key === '$nor') {
		// Multiple sub-finds
		if (property.value.type !== 'array') {
			return []
		}

		let element = property.value.values[property.value.cursor]
		if (!element || element.type !== 'object') {
			return []
		}

		return Suggest._processCursorInFind(element, schema, prefix)
	} else if (property.value.type === 'array' || property.value.type === 'source') {
		// Focus in field value
		return Suggest._suggestValues(property.value.raw, schema[subPrefix])
	} else if (property.value.type === 'object') {
		return Suggest._processCursorInFieldExp(property.value, schema, subPrefix)
	} else {
		// Unknown
		return []
	}
}

/**
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @returns {Array<Suggest~Result>}
 * @private
 */
Suggest._processCursorInFieldExp = function (parsed, schema, prefix) {
	let keys = parsed.properties.map(prop => prop.key)

	if (keys.some(key => key[0] !== '$')) {
		// Not actually a field expression, like in '{a: {b: 2}}',
		// '{b: 2}' is not a field expression
		return Suggest._suggestValues(parsed.raw, schema[prefix])
	}

	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestOperators('', schema, prefix, keys)
	}

	let property = parsed.properties[parsed.cursor],
		key = property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		let search = property.key.slice(0, property.keyCursor)
		return Suggest._suggestOperators(search, schema, prefix, keys)
	} else if (key === '$eq' || key === '$ne' ||
		key === '$gt' || key === '$gte' ||
		key === '$lt' || key === '$lte') {
		// COMP VALUE
		return Suggest._suggestValues(property.value.raw, schema[prefix])
	} else if (key === '$in' || key === '$nin' || key === '$all') {
		// COMP [VALUE]
		if (property.value.type !== 'array') {
			return []
		}

		let element = property.value.values[property.value.cursor]
		return Suggest._suggestValues(element ? element.raw : '', schema, prefix)
	} else if (key === '$not') {
		// $not FIELD-EXP
		if (property.value.type !== 'object') {
			return []
		}

		return Suggest._processCursorInFieldExp(property.value, schema, prefix)
	} else if (key === '$exists') {
		// $exists BOOL
		return Suggest._suggestValues(property.value.raw, {
			bool: true
		})
	} else if (key === '$type') {
		// $type STRING
		return Suggest._suggestValues(property.value.raw, {
			string: [
				'double',
				'string',
				'object',
				'array',
				'binData',
				'objectId',
				'bool',
				'date',
				'null',
				'regex',
				'javascript',
				'javascriptWithScope',
				'int',
				'timestamp',
				'long',
				'minKey',
				'maxKey',
				'number'
			]
		})
	} else if (key === '$mod') {
		// $mod [NUM, NUM]
		return [{
			text: '[divisor, remainder]'
		}]
	} else if (key === '$elemMatch') {
		// $elemMatch FIND
		if (property.value.type !== 'object') {
			return []
		}

		return Suggest._processCursorInFind(property.value, schema, prefix)
	} else if (key === '$size') {
		// $size NUM
		return [{
			text: '(number)'
		}]
	} else {
		// Unknown
		return []
	}
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @param {Array<string>} blacklist - keys already used at this level
 * @returns {Array<Suggest~Result>}
 * @private
 */
Suggest._suggestFields = function (search, schema, prefix, blacklist) {
	// search='a', prefix='' -> pathPrefix='', field='a'
	// search='a.b', prefix='' -> pathPrefix='a.', field='b'
	// search='a', prefix='x' -> pathPrefix='x.', field='a'
	// search='ab.cd.e', prefix='x' -> pathPrefix='x.ab.cd.', field='e'
	let lastDot = search.lastIndexOf('.'),
		keyPrefix = lastDot === -1 ? '' : search.slice(0, lastDot + 1),
		pathPrefix = (prefix ? prefix + '.' : '') + keyPrefix,
		field = lastDot === -1 ? search : search.slice(lastDot + 1),
		fieldLC = field.toLowerCase(),
		/** @var {Array<{text: string, terms: Array<string>}>} */
		searchSpace = lastDot === -1 ? [{
			text: '$or',
			terms: ['$or']
		}, {
			text: '$and',
			terms: ['$and']
		}, {
			text: '$nor',
			terms: ['$nor']
		}] : []

	// Collect fields in the same and following levels
	for (let path in schema) {
		if (path.startsWith(pathPrefix)) {
			let text = path.slice(pathPrefix.length),
				key = path.slice(keyPrefix.length)

			if (blacklist.indexOf(key) !== -1) {
				continue
			}

			searchSpace.push({
				text: text,
				data: {
					key: key,
					path: path
				},
				terms: text.toLowerCase().split('.')
			})
		}
	}

	let matches
	if (field.length <= 3) {
		// Make a case-insensitive prefix match
		matches = searchSpace.filter(item => {
			return item.terms.some(part => {
				return part.startsWith(fieldLC)
			})
		}).sort((a, b) => {
			// Depth ASC, text ASC
			return a.terms.length - b.terms.length ||
				(a.text > b.text ? 1 : (a.text === b.text ? 0 : -1))
		})
	} else {
		// Make a case-insensitive ngram match
		matches = NGram.search(NGram.index(searchSpace), [fieldLC]).sort((a, b) => {
			// Depth ASC, score DESC
			return a.value.terms.length - b.value.terms.length || b.score - a.score
		}).map(e => e.value)
	}

	// Pick 5
	return matches.slice(0, 5)
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @param {Array<string>} blacklist
 * @returns {Array<Suggest~Result>}
 * @private
 */
Suggest._suggestOperators = function (search, schema, prefix, blacklist) {
	let operators = [
			// Basic operators
			'$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
			'$in', '$nin', '$not', '$type'
		],
		fieldSchema = schema[prefix]

	// Additional type-dependent operators
	if (fieldSchema) {
		if (fieldSchema.null) {
			operators.push('$exists')
		}
		if (fieldSchema.double) {
			operators.push('$mod')
		}
		if (fieldSchema.array && fieldSchema.object) {
			operators.push('$elemMatch')
		}
		if (fieldSchema.array) {
			operators.push('$size', '$all')
		}
	}

	if (search[0] !== '$') {
		search = '$' + search
	}

	return operators.filter(op => {
		return blacklist.indexOf(op) === -1 && op.startsWith(search)
	}).sort().slice(0, 5).map(op => ({
		text: op
	}))
}

/**
 * @param {string} search
 * @param {?Sample~FieldSchema} fieldSchema
 * @returns {Array<Suggest~Result>}
 * @private
 */
Suggest._suggestValues = function (search, fieldSchema) {
	if (!fieldSchema) {
		// Nothing useful to provide
		return []
	}

	search = search.trim()
	let values = [],
		quote = search[0] === '"' ? '"' : '\''
	if (Array.isArray(fieldSchema.double)) {
		values = values.concat(fieldSchema.double.map(e => String(e)))
	}
	if (Array.isArray(fieldSchema.string)) {
		values = values.concat(fieldSchema.string.map(e => quote + Suggest._escape(e) + quote))
	}
	if (fieldSchema.bool) {
		values.push('true')
		values.push('false')
	}
	values = values.filter(value => {
		return value.startsWith(search)
	}).sort().slice(0, 5)

	let types = [
		'double',
		'string',
		'object',
		'array',
		'binData',
		'objectId',
		'date',
		'null',
		'regex',
		'timestamp',
		'long',
		'minKey',
		'maxKey'
	]

	types.forEach(type => {
		if (fieldSchema[type]) {
			values.push('(' + type + ')')
		}
	})

	return values.map(v => ({
		text: v
	}))
}

/**
 * Escape a string to put between quotes
 * @param {string} str
 * @returns {string}
 * @private
 */
Suggest._escape = function (str) {
	return str.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/"/g, '\\"')
}