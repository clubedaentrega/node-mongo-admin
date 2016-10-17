/*global NGram*/
'use strict'

let Suggest = {}

/**
 * Make suggestions based on the cursor position and schema definition
 * @param {Parse~Object} parsed
 * @param {Sample~Schema} schema
 * @returns {Array<string>}
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
 * @returns {Array<string>}
 * @private
 */
Suggest._processCursorInFind = function (parsed, schema, prefix) {
	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestFields('', schema, prefix)
	}

	let property = parsed.properties[parsed.cursor],
		subPrefix = prefix ? prefix + '.' + property.key : property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		return Suggest._suggestFields(property.key.slice(0, property.keyCursor), schema, prefix)
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
		return Suggest._suggestValues(property.value.raw, schema, subPrefix)
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
 * @returns {Array<string>}
 * @private
 */
Suggest._processCursorInFieldExp = function (parsed, schema, prefix) {
	if (parsed.properties.some(property => property.key[0] !== '$')) {
		// Not actually a field expression, like in '{a: {b: 2}}',
		// '{b: 2}' is not a field expression
		return Suggest._suggestValues(parsed.raw, schema, prefix)
	}

	if (parsed.cursor === -1) {
		// Nothing is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return Suggest._suggestOperators('', schema, prefix)
	}

	let property = parsed.properties[parsed.cursor],
		key = property.key
	if (property.keyCursor !== -1) {
		// Key has focus
		return Suggest._suggestOperators(property.key.slice(0, property.keyCursor), schema, prefix)
	} else if (key === '$eq' || key === '$ne' ||
		key === '$gt' || key === '$gte' ||
		key === '$lt' || key === '$lte') {
		// COMP VALUE
		return Suggest._suggestValues(property.value.raw, schema, prefix)
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
		return ['true', 'false']
	} else if (key === '$type') {
		// $type STRING | $type NUM
		return ['enums for $type']
	} else if (key === '$mod') {
		// $mod [NUM, NUM]
		return ['[divisor, remainder]']
	} else if (key === '$elemMatch') {
		// $elemMatch FIND
		if (property.value.type !== 'object') {
			return []
		}

		return Suggest._processCursorInFind(property.value, schema, prefix)
	} else if (key === '$size') {
		// $size NUM
		return ['num']
	} else {
		// Unknown
		return []
	}
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @returns {Array<string>}
 * @private
 */
Suggest._suggestFields = function (search, schema, prefix) {
	// search='a', prefix='' -> prefix='', field='a'
	// search='a.b', prefix='' -> prefix='a.', field='b'
	// search='a', prefix='x' -> prefix='x.', field='a'
	// search='ab.cd.e', prefix='x' -> prefix='x.ab.cd.', field='e'
	let lastDot = search.lastIndexOf('.'),
		pathPrefix = (prefix ? prefix + '.' : '') +
		(lastDot === -1 ? '' : search.slice(0, lastDot + 1)),
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
			let text = path.slice(pathPrefix.length)
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

	// Pick 5
	return matches.slice(0, 5).map(e => e.text)
}

/**
 * @param {string} search
 * @param {Sample~Schema} schema
 * @param {string} prefix
 * @returns {Array<string>}
 * @private
 */
Suggest._suggestOperators = function (search, schema, prefix) {
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
			return op.startsWith(search)
		}).sort().slice(0, 5)
	}
	/**
	 * @param {string} search
	 * @param {Sample~Schema} schema
	 * @param {string} prefix
	 * @returns {Array<string>}
	 * @private
	 */
Suggest._suggestValues = function (search, schema, prefix) {
	let fieldSchema = schema[prefix]

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
		'bool',
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

	return values
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