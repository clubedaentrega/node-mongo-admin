'use strict'

let Replacer = {}

/**
 * @typedef {Object} Replacer~Result
 * @property {string} text
 * @property {string} cursor
 */

/**
 * Apply a replacement to the given source string
 * @param {string} base
 * @property {string} replacement
 * @property {string} type - either 'property' or 'value'
 * @property {Parse~Object|Parse~Base} context - Object for 'property' and Base for 'value'
 * @returns {Replacer~Result}
 */
Replacer.replace = function (base, replacement, type, context) {
	if (type === 'property') {
		let property = context.properties[context.cursor]
		if (context.cursor === context.properties.length) {
			// New property
			console.log('TODO')
		} else if (property.key.cursor !== -1) {
			// Replace key
			let namePos = property.key.raw.indexOf(property.key.name),
				// Matches /^\s['"]?$/
				keyPrefix = property.key.raw.slice(0, namePos),
				// Matches /^((['"].*)?:)?$/
				keySuffix = property.key.raw.slice(namePos + property.key.name.length),
				quote = keyPrefix.trim()[0],
				needQuote = !/^[a-z_$][a-z0-9_$]*$/i.test(replacement)

			// Build new raw code for the key
			let newRaw
			if (needQuote) {
				if (!quote) {
					quote = '\''
					keyPrefix += quote
				}
				keySuffix = keySuffix || quote + ': '
				newRaw = keyPrefix + Replacer._escape(replacement) + keySuffix
			} else {
				if (quote) {
					keyPrefix = keyPrefix.slice(0, -1)
				}
				keySuffix = keySuffix[0] === '\'' || keySuffix[0] === '"' ? keySuffix.slice(1) : ': '
				newRaw = keyPrefix + replacement + keySuffix
			}

			// Replace and return
			return {
				text: base.slice(0, property.key.start) +
					newRaw +
					base.slice(property.key.start + property.key.raw.length),
				cursor: property.key.start + newRaw.length
			}
		}
	}
}

/**
 * Escape a string to put between quotes
 * @param {string} str
 * @returns {string}
 * @private
 */
Replacer._escape = function (str) {
	return str.replace(/\\/g, '\\\\').replace(/'/g, '\\\'').replace(/"/g, '\\"')
}