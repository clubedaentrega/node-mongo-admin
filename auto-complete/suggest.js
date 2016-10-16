'use strict'

let ngram = require('./ngram')

/**
 * @param {ParsedObject} parsed
 * @param {Schema} schema
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

	return suggestFields(property.key.slice(0, property.keyCursor), schema)
}

/**
 * @param {string} search
 * @param {Schema} schema
 */
function suggestFields(search, schema) {
	// 'ab.cd.e' -> prefix='ab.cd.', field='e'
	let lastDot = search.lastIndexOf('.'),
		pathPrefix = lastDot === -1 ? '' : search.slice(0, lastDot + 1),
		field = lastDot === -1 ? search : search.slice(lastDot + 1),
		fieldLC = field.toLowerCase(),
		/** @var {Array<{text: string, depth: number}>} */
		searchSpace = []

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
			// Depth ASC
			return a.terms.length - b.terms.length
		})
	} else {
		// Make a case-insensitive ngram match
		matches = ngram.search(ngram.index(searchSpace), [fieldLC]).sort((a, b) => {
			// Depth ASC, score DESC
			return a.value.terms.length - b.value.terms.length || b.score - a.score
		}).map(e => e.value)
	}

	if (matches.length > 10) {
		// Too many matches
		return []
	}

	// Pick 5
	return matches.slice(0, 5).map(e => e.text)
}