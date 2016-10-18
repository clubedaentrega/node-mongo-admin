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
		return Replacer._replaceProperty(base, replacement, context)
	} else if (type === 'value') {
		return Replacer._replaceValue(base, replacement, context)
	}
}

/**
 * Apply a property replacement to the given source string
 * @param {string} base
 * @property {string} replacement
 * @property {Parse~Object} context
 * @returns {Replacer~Result}
 */
Replacer._replaceProperty = function (base, replacement, context) {
	let property = context.properties[context.cursor]
	if (context.cursor === context.properties.length) {
		// New property
		let needQuote = !/^[a-z_$][a-z0-9_$]*$/i.test(replacement)

		// Build new raw code for the key
		let newRaw
		if (needQuote) {
			newRaw = '\'' + Replacer._escape(replacement) + '\': '
		} else {
			newRaw = replacement + ': '
		}

		// Replace and return
		return {
			text: base.slice(0, context.start + context.raw.length - 1) +
				newRaw +
				base.slice(context.start + context.raw.length - 1),
			cursor: context.start + context.raw.length - 1 + newRaw.length
		}
	} else if (property.key.cursor !== -1) {
		/*
		 * Replace key. In the examples bellow, _ means a blank space and | means cursor.
		 * ___"ab.c|d.ef"xyz:
		 * ^^^^^^^       ^^^^
		 * |||||||       +++++- key suffix
		 * ||||+++- name suffix
		 * ++++- key prefix
		 * 
		 * raw = ___"ab.c|d.ef"xyz:
		 * name = ab.cd.ef
		 * nameStartPos = 4
		 * keyPrefix = ___"
		 * keySuffix = "xyz:
		 * nameFullPrefix = ab.c
		 * lastDot = 2
		 * namePrefix = ab.
		 * quote = "
		 */

		let raw = property.key.raw,
			name = property.key.name,
			nameStartPos = raw.indexOf(name),
			// Matches /^\s['"]?$/
			keyPrefix = raw.slice(0, nameStartPos),
			// Matches /^((['"].*)?:)?$/
			keySuffix = raw.slice(nameStartPos + name.length),
			nameFullPrefix = name.slice(0, property.key.cursor),
			lastDot = nameFullPrefix.lastIndexOf('.'),
			namePrefix = lastDot === -1 ? '' : nameFullPrefix.slice(0, lastDot + 1),
			quote = keyPrefix.trim()[0]
		replacement = namePrefix + replacement
		let needQuote = !/^[a-z_$][a-z0-9_$]*$/i.test(replacement)

		// Build new raw code for the key
		let newRaw
		if (needQuote) {
			if (!quote) {
				quote = '\''
				keyPrefix += quote
			}
			if (keySuffix[0] === '\'' || keySuffix[0] === '"') {
				keySuffix = keySuffix.slice(1)
			}
			keySuffix = quote + (keySuffix || ': ')
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
				base.slice(property.key.start + raw.length),
			cursor: property.key.start + newRaw.length - 1
		}
	}
}

/**
 * Apply a value replacement to the given source string
 * @param {string} base
 * @property {string} replacement
 * @property {Parse~Base} context
 * @returns {Replacer~Result}
 */
Replacer._replaceValue = function (base, replacement, context) {
	let needComma = context.raw.endsWith(','),
		cutStart = context.start,
		cutEnd = cutStart + context.raw.length + (needComma ? -1 : 0),
		spaces = context.raw.match(/^(\s*).*?(\s*)$/),
		spacesPrefix = spaces[1],
		spacesSuffix = spaces[1]

	let replacementMap = {
		'(double)': '|',
		'(string)': '\'|\'',
		'(object)': '{|}',
		'(array)': '[|]',
		'(binData)': 'BinData(0, \'|\')',
		'(objectId)': 'ObjectId(\'|\')',
		'(date)': 'ISODate(\'|\')',
		'(null)': 'null|',
		'(regex)': '/|/',
		'(long)': 'Long(\'|\')',
		'(minKey)': 'MinKey()|',
		'(maxKey)': 'MaxKey()|'
	}

	if (replacementMap.hasOwnProperty(replacement)) {
		// Special replacement
		replacement = replacementMap[replacement]
		let cursorOffset = replacement.indexOf('|')
		replacement = replacement.replace('|', '')
		return {
			text: base.slice(0, cutStart) +
				spacesPrefix + replacement + spacesSuffix +
				base.slice(cutEnd),
			cursor: cutStart + spacesPrefix.length + cursorOffset
		}
	}

	// Replace and return
	return {
		text: base.slice(0, cutStart) +
			spacesPrefix + replacement + spacesSuffix +
			base.slice(cutEnd),
		cursor: cutStart + spacesPrefix.length + replacement.length
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