'use strict'

let ngram = require('./ngram')

/**
 * @param {ParsedObject} parsed
 * @param {SchemaNode} schema
 * @returns {Array<string>}
 */
module.exports = function (parsed, schema) {
	// Get key to auto-complete
	if (parsed.cursor === -1) {
		// No property is focused
		return []
	} else if (parsed.cursor === parsed.properties.length) {
		// Empty property focused
		return suggestFields('', [schema])
	}

	let property = parsed.properties[parsed.cursor]
	if (property.keyCursor === -1) {
		// Key is not focused
		return []
	}

	return suggestFields(property.key.slice(0, property.keyCursor), [schema])
}

/**
 * @param {string} search
 * @param {Array<SchemaNode>} schemas - schemas to consider. They all must have 'children' set
 */
function suggestFields(search, schemas) {
	// Split field in parts
	let parts = search.split('.'),
		lastPart = parts.pop()

	// Assume all prefix parts are correct and
	// collect relevant subschemas
	let subSchemas = schemas
	for (let part of parts) {
		let newSubSchemas = []

		// Collect new sub schemas for every sub schema already being considered
		for (let j = 0; j < subSchemas.length; j++) {
			let newSubSchema = subSchemas[j].children[part]

			if (newSubSchema && newSubSchema.children) {
				newSubSchemas.push(newSubSchema)

				// Also collect any sub schema of array elements
				while (newSubSchema.children.$ && newSubSchema.children.$.children) {
					newSubSchema = newSubSchema.children.$
					newSubSchemas.push(newSubSchema)
				}
			}
		}

		subSchemas = newSubSchemas
	}

	// Collect all level fields
	let levelFieldSet = new Set
	for (let subSchema of subSchemas) {
		for (let field in subSchema.children) {
			if (field !== '$') {
				levelFieldSet.add(field)
			}
		}
	}
	let levelFields = Array.from(levelFieldSet)

	// Make a case-insensitive prefix match
	let matches
	if (lastPart.length <= 3) {
		matches = levelFields.filter(field => {
			return field.toLowerCase().startsWith(lastPart.toLowerCase())
		})
		matches.sort()
	} else {
		matches = ngram.search(ngram.index(levelFields), lastPart)
	}

	if (matches.length > 10) {
		// Too many matches
		return []
	}

	// Pick 5
	if (matches.length >= 5) {
		return matches.slice(0, 5)
	}

	// Collect all descending fields
	let allFieldSet = new Set
	for (let subSchema of subSchemas) {
		for (let field in subSchema.children) {
			if (field !== '$') {
				recurseCollect(subSchema.children[field], field + '.')
			}
		}
	}
	let allFields = Array.from(allFieldSet)

	// Make a case-insensitive prefix match
	let newMatches
	if (lastPart.length <= 3) {
		newMatches = allFields.filter(field => {
			return field.toLowerCase().split('.').some(part => {
				return part.startsWith(lastPart.toLowerCase())
			})
		})
		newMatches.sort()
	} else {
		newMatches = ngram.search(ngram.index(allFields), lastPart)
	}

	return matches.concat(newMatches).slice(0, 5)

	/**
	 * @param {SchemaNode} schema
	 * @param {string} prefix
	 */
	function recurseCollect(schema, prefix) {
		if (!schema.children) {
			return
		}

		for (let field in schema.children) {
			if (field !== '$') {
				allFieldSet.add(prefix + field)
				recurseCollect(schema.children[field], prefix + field + '.')
			} else {
				recurseCollect(schema.children.$, prefix)
			}
		}
	}
}