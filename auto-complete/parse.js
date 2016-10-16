'use strict'

/**
 * @typedef {Object} Parsed
 * @property {string} type
 * @property {string} raw - raw source string
 */

/**
 * @typedef {Parsed} ParsedObject
 * @property {Array<ParsedKeyValue>} properties
 * @property {number} cursor - property index the cursor is at
 */

/**
 * @typedef {Parsed} ParsedKeyValue
 * @property {string} key
 * @property {Parsed} value
 * @property {number} keyCursor - cursor position in key text
 */

/**
 * @typedef {Parsed} ParsedArray
 * @property {Array<Parsed>} values
 * @property {number} cursor - value index the cursor is at
 */

/**
 * @typedef {Parsed} ParsedSource
 * @property {number} cursor - cursor position in raw text
 */

/**
 * @param {string} str
 * @param {number} cursor
 * @returns {Parsed}
 */
module.exports = function (str, cursor) {
	return readValue({
		type: 'source',
		raw: str,
		cursor: cursor
	})
}

/**
 * Extract a JS expression from the beginning of the string.
 * It uses delimiter couting to know where the expression ends.
 * It is not an error to leave delimiter unclosed, like in "{a: 2".
 * Unmatched closing delimiters are ignore, like ')' in "{a: )}"
 * @param {ParsedSource} source - will be modified
 * @returns {Parsed}
 */
function readValue(source) {
	// Stack of open delimiters: {, [, (, `, ', "
	let stack = [],
		// Last stack level
		mode = 'root',
		// Whether this is may be a pure object or array
		seemsPure = true,
		// First delimiter
		first = '',
		i

	for (i = 0; i < source.raw.length; i++) {
		let c = source.raw[i]

		if ((mode === '{' && c === '}') ||
			(mode === '[' && c === ']') ||
			(mode === '(' && c === ')') ||
			(mode === '`' && c === '`') ||
			(mode === '\'' && c === '\'') ||
			(mode === '"' && c === '"')) {
			// Close delimiter
			mode = stack.pop()
		} else if (c === '{' || c === '[' || c === '(' ||
			c === '`' || c === '\'' || c === '"') {
			// Open delimiter
			stack.push(mode)
			mode = c

			if (!first) {
				first = c
			}
		} else if ((mode === '`' || mode === '\'' || mode === '"') && c === '\\') {
			// Escape next char
			i += 1
		} else if (mode === 'root' && c === ',') {
			// End of expression
			break
		} else if (seemsPure && mode === 'root' && !/^\s$/.test(c)) {
			// Pure objects/arrays can't have any non-whitespace char at root
			seemsPure = false
		}
	}

	// Slice source
	let valueSource = {
		type: 'source',
		raw: source.raw.slice(0, i + 1),
		cursor: sliceCursor(source.cursor, 0, i + 1)
	}
	source.cursor = sliceCursor(source.cursor, i + 1, source.raw.length)
	source.raw = source.raw.slice(i + 1)

	// Promote pure types
	if (seemsPure && first === '{') {
		return promoteObject(valueSource, mode === 'root')
	} else if (seemsPure && first === '[') {
		return promoteArray(valueSource, mode === 'root')
	}

	// Fallback to raw source
	return valueSource
}

/**
 * Parse an object source
 * @param {ParsedSource} source
 * @param {boolean} gentleEnd - whether the object body was ended correctly
 * @returns {ParsedObject}
 */
function promoteObject(source, gentleEnd) {
	// Extract object body string
	// The raw string is garanteed to start with spaces and a '{'
	// Depending on gentleEnd it may end with or without '}' spaces and ','
	let match = source.raw.match(gentleEnd ? /^(\s*\{)(.*)\}\s*,?$/ : /^(\s*\{)(.*)$/),
		before = match[1],
		body = match[2],
		subSource = {
			type: 'source',
			raw: body,
			cursor: sliceCursor(source.cursor, before.length, before.length + body.length)
		}

	// Read properties
	let properties = [],
		cursor = -1,
		key
	while (/\S/.test(subSource.raw)) {
		let hadCursor = subSource.cursor !== -1
		key = readKey(subSource)
		properties.push({
			key: key.name,
			value: readValue(subSource),
			keyCursor: key.cursor
		})
		if (hadCursor && subSource.cursor === -1) {
			// Cursor is trapped in the property
			cursor = properties.length - 1
		}
	}

	if (subSource.cursor !== -1) {
		// Cursor at the end
		cursor = properties.length
	}

	return {
		type: 'object',
		raw: source.raw,
		properties: properties,
		cursor: cursor
	}
}

/**
 * Parse an array source
 * @param {ParsedSource} source
 * @param {boolean} gentleEnd - whether the array body was ended correctly
 * @returns {ParsedArray}
 */
function promoteArray(source, gentleEnd) {
	// Extract array body string
	// The raw string is garanteed to start with spaces and a '['
	// Depending on gentleEnd it may end with or without ']' spaces and ','
	let match = source.raw.match(gentleEnd ? /^(\s*\[)(.*)\]\s*,?$/ : /^(\s*\[)(.*)$/),
		before = match[1],
		body = match[2],
		subSource = {
			type: 'source',
			raw: body,
			cursor: sliceCursor(source.cursor, before.length, before.length + body.length)
		}

	// Read values
	let values = [],
		cursor = -1
	while (/\S/.test(subSource.raw)) {
		let hadCursor = subSource.cursor !== -1
		values.push(readValue(subSource))
		if (hadCursor && subSource.cursor === -1) {
			// Cursor is trapped in the property
			cursor = values.length - 1
		}
	}

	if (subSource.cursor !== -1) {
		// Cursor at the end
		cursor = values.length
	}

	return {
		type: 'array',
		raw: source.raw,
		values: values,
		cursor: cursor
	}
}

/**
 * Extract an object key from the beginning of the string.
 * It is not an error to not use quotes when needed, like: "a.b: 2".
 * Invalid characters between close quotes and ':' are ignore, like 'x' in '"a"x: 2'
 * @param {ParsedSource} source - will be modified
 * @returns {?{name: string, cursor: number}}
 */
function readKey(source) {
	let mode = 'start',
		// First char in the key
		startIndex = -1,
		// First char not in the key
		endIndex = -1,
		i

	for (i = 0; i < source.raw.length; i++) {
		let c = source.raw[i]

		if (mode === 'start') {
			if (/^\s$/.test(c)) {
				// Ignore leading spaces
			} else if (c === '\'' || c === '"') {
				// Quoted key
				mode = c
				startIndex = i + 1
			} else {
				// Unquoted
				mode = 'bare'
				startIndex = i
			}
		} else if (mode === '\'' || mode === '"') {
			if (c === '\\') {
				// Escape next char
				i += 1
			} else if (c === mode) {
				// End of key
				mode = 'end'
				endIndex = i
			}
		} else if (mode === 'bare') {
			if (c === ':') {
				// End unquoted key
				endIndex = i
				break
			}
		} else if (mode === 'end') {
			if (c === ':') {
				// End quoted key
				break
			}
		}
	}

	if (startIndex === -1) {
		// Not found
		return null
	}

	if (endIndex === -1) {
		// Assume the whole text is part of the key
		endIndex = source.raw.length
	}

	let key = {
		name: source.raw.slice(startIndex, endIndex),
		cursor: sliceCursor(source.cursor, startIndex, endIndex)
	}
	source.cursor = sliceCursor(source.cursor, i + 1, source.raw.length)
	source.raw = source.raw.slice(i + 1)
	return key
}

/**
 * Compute the new position for the cursor after a slice
 * @param {number} cursor
 * @param {number} start
 * @param {number} end
 */
function sliceCursor(cursor, start, end) {
	if (cursor === -1) {
		// Already out of bounds
		return -1
	} else if (cursor >= start && cursor <= end) {
		// Moved
		return cursor - start
	} else {
		// Will be out of bounds
		return -1
	}
}