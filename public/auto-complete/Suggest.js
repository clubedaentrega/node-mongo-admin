/*global NGram*/
'use strict'

/**
 * @typedef {Object} Suggest~Result
 * @property {Array<string>} texts
 * @property {string} type - either 'property' or 'value'
 * @property {Parse~Object|Parse~Base} context - Object for 'property' and Base for 'value'
 */

let Suggest = {}

/**
 * Make suggestions based on the cursor position and schema definition
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @returns {?Suggest~Result}
 */
Suggest.getSuggestions = function (parsed, schema) {
	if (parsed.type !== 'object') {
		return
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
 * @returns {?Suggest~Result}
 * @private
 */
Suggest._processCursorInFind = function (parsed, schema, prefix) {
	let keys = parsed.properties.map(prop => prop.key.name)

	if (parsed.cursor === -1) {
		// Nothing is focused
		return
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestFields('', schema, prefix, keys, parsed)
	}

	let property = parsed.properties[parsed.cursor],
		key = property.key.name,
		subPrefix = prefix ? prefix + '.' + key : key
	if (property.key.cursor !== -1) {
		// Key has focus
		let search = key.slice(0, property.key.cursor)
		return Suggest._suggestFields(search, schema, prefix, keys, parsed)
	} else if (key === '$or' || key === '$and' || key === '$nor') {
		// Multiple sub-finds
		if (property.value.type !== 'array') {
			return
		}

		let element = property.value.values[property.value.cursor]
		if (!element || element.type !== 'object') {
			return
		}

		return Suggest._processCursorInFind(element, schema, prefix)
	} else if (property.value.type === 'array' || property.value.type === 'source') {
		// Focus in field value
		return Suggest._suggestValues(property.value.raw, schema[subPrefix], property.value)
	} else if (property.value.type === 'object') {
		return Suggest._processCursorInFieldExp(property.value, schema, subPrefix)
	} else {
		// Unknown
		return
	}
}

/**
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @returns {?Suggest~Result}
 * @private
 */
Suggest._processCursorInFieldExp = function (parsed, schema, prefix) {
	let keys = parsed.properties.map(prop => prop.key.name)

	if (keys.some(key => key[0] !== '$')) {
		// Not actually a field expression, like in '{a: {b: 2}}',
		// '{b: 2}' is not a field expression
		return Suggest._suggestValues(parsed.raw, schema[prefix], parsed)
	}

	if (parsed.cursor === -1) {
		// Nothing is focused
		return
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestOperators('', schema, prefix, keys, parsed)
	}

	let property = parsed.properties[parsed.cursor],
		key = property.key.name
	if (property.key.cursor !== -1) {
		// Key has focus
		let search = key.slice(0, property.key.cursor)
		return Suggest._suggestOperators(search, schema, prefix, keys, parsed)
	} else if (key === '$eq' || key === '$ne' ||
		key === '$gt' || key === '$gte' ||
		key === '$lt' || key === '$lte') {
		// COMP VALUE
		return Suggest._suggestValues(property.value.raw, schema[prefix], property.value)
	} else if (key === '$in' || key === '$nin' || key === '$all') {
		// COMP [VALUE]
		if (property.value.type !== 'array') {
			return
		}

		let element = property.value.values[property.value.cursor]
		return Suggest._suggestValues(element ? element.raw : '', schema[prefix], property.value)
	} else if (key === '$not') {
		// $not FIELD-EXP
		if (property.value.type !== 'object') {
			return
		}

		return Suggest._processCursorInFieldExp(property.value, schema, prefix)
	} else if (key === '$exists') {
		// $exists BOOL
		return Suggest._suggestValues(property.value.raw, {
			bool: true
		}, property.value)
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
		}, property.value)
	} else if (key === '$mod') {
		// $mod [NUM, NUM]
		return [{
			text: '[divisor, remainder]'
		}]
	} else if (key === '$elemMatch') {
		// $elemMatch FIND
		if (property.value.type !== 'object') {
			return
		}

		return Suggest._processCursorInFind(property.value, schema, prefix)
	} else if (key === '$size') {
		// $size NUM
		return [{
			text: '(number)'
		}]
	} else {
		// Unknown
		return
	}
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @param {Array<string>} blacklist - keys already used at this level
 * @param {Parse~Object} context
 * @returns {?Suggest~Result}
 * @private
 */
Suggest._suggestFields = function (search, schema, prefix, blacklist, context) {
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
		searchSpace = []

	if (lastDot === -1) {
		for (let operator of['$or', '$and', '$nor']) {
			if (blacklist.indexOf(operator) === -1) {
				searchSpace.push({
					text: operator,
					terms: [operator]
				})
			}
		}
	}

	// Collect fields in the same and following levels
	for (let path in schema) {
		if (path.startsWith(pathPrefix)) {
			let text = path.slice(pathPrefix.length),
				key = path.slice((prefix ? prefix + '.' : '').length)

			if (blacklist.indexOf(key) !== -1) {
				continue
			}

			searchSpace.push({
				text: text,
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

	// If there are too many items in the current depth,
	// the result is probably not relevant
	let countDepth1 = 0
	for (let i = 0; i < matches.length; i++) {
		if (matches[i].terms.length === 1) {
			countDepth1 += 1
			if (countDepth1 > 10) {
				return
			}
		}
	}

	// Pick 5
	return {
		texts: matches.slice(0, 5).map(e => e.text),
		type: 'property',
		context: context
	}
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @param {Array<string>} blacklist
 * @param {Parse~Object} context
 * @returns {?Suggest~Result}
 * @private
 */
Suggest._suggestOperators = function (search, schema, prefix, blacklist, context) {
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

	let matches = operators.filter(op => {
		return blacklist.indexOf(op) === -1 && op.startsWith(search)
	}).sort()

	return {
		texts: matches.slice(0, 5),
		type: 'property',
		context: context
	}
}

/**
 * @param {string} search
 * @param {?Sample~FieldSchema} fieldSchema
 * @param {Parse~Base} context
 * @returns {?Suggest~Result}
 * @private
 */
Suggest._suggestValues = function (search, fieldSchema, context) {
	if (!fieldSchema) {
		// Nothing useful to provide
		return
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

	return {
		texts: values,
		type: 'value',
		context: context
	}
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