'use strict'

let Parse = {}

/**
 * @typedef {Object} Parse~Base
 * @property {string} type
 * @property {string} raw - raw source string
 * @property {number} start - global start position of the raw substring
 */

/**
 * @typedef {Parse~Base} Parse~Object
 * @property {Array<Parse~KeyValue>} properties
 * @property {number} cursor - property index the cursor is at
 */

/**
 * @typedef {Object} Parse~KeyValue
 * @property {Parse~Key} key
 * @property {Parse~Base} value
 */

/**
 * @typedef {Parse~Base} Parse~Key
 * @property {string} name
 * @property {number} cursor - cursor position in key name
 */

/**
 * @typedef {Parse~Base} Parse~Array
 * @property {Array<Parse~Base>} values
 * @property {number} cursor - value index the cursor is at
 */

/**
 * @typedef {Parse~Base} Parse~Source
 * @property {number} cursor - cursor position in raw text
 */

/**
 * @param {string} str
 * @param {number} cursor
 * @returns {Parse~Base}
 */
Parse.parse = function (str, cursor) {
	return Parse._readValue({
		type: 'source',
		raw: str,
		cursor: cursor,
		start: 0
	})
}

/**
 * Extract a JS expression from the beginning of the string.
 * It uses delimiter couting to know where the expression ends.
 * It is not an error to leave delimiter unclosed, like in "{a: 2".
 * Unmatched closing delimiters are ignored, like ')' in "{a: )}"
 * @param {Parse~Source} source - will be modified
 * @param {boolean} [useStopChars=false] - whether to stop parsing on a stop-char (like '}')
 * @returns {Parse~Base}
 * @private
 */
Parse._readValue = function (source, useStopChars) {
	// Stack of open delimiters: {, [, (, ', "
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
			(mode === '\'' && c === '\'') ||
			(mode === '"' && c === '"')) {
			// Close delimiter
			mode = stack.pop()
		} else if (useStopChars && i >= source.cursor && mode !== 'root' &&
			(c === '}' || c === ']' || c === ')')) {
			// Unmatched close delimiter after cursor
			// Assume it should close some corresponding open delimiter
			let targetMode = c === '}' ? '{' : (c === ']' ? '[' : ')')
			do {
				mode = stack.pop()
			} while (mode !== 'root' && mode !== targetMode)

			if (mode !== 'root') {
				// Pop the c level
				mode = stack.pop()
			}
		} else if (mode === '\'' || mode === '"') {
			if (c === '\\') {
				// Escape next char
				i += 1
			}
		} else if (c === '{' || c === '[' || c === '(' ||
			c === '\'' || c === '"') {
			// Open delimiter
			stack.push(mode)
			mode = c

			if (!first) {
				first = c
			}
		} else if (mode === 'root' && c === ',') {
			// End of expression
			break
		} else if (seemsPure && mode === 'root' && !/^\s$/.test(c)) {
			// Pure objects/arrays can't have any non-whitespace char at root
			seemsPure = false
		}
	}

	if (!useStopChars && mode !== 'root' && source.cursor !== -1) {
		// Not properly closed, like in:
		// {a: ['|], b: 2}
		// We'll assume the any unmatched }, ], ), ', " marks the end
		return Parse._readValue(source, true)
	}

	// Slice source
	let valueSource = {
		type: 'source',
		raw: source.raw.slice(0, i + 1),
		cursor: Parse._sliceCursor(source.cursor, 0, i + 1),
		start: source.start
	}
	source.cursor = Parse._sliceCursor(source.cursor, i + 1, source.raw.length)
	source.raw = source.raw.slice(i + 1)
	source.start += i + 1

	// Promote pure types
	if (seemsPure && first === '{') {
		return Parse._promoteObject(valueSource, mode === 'root')
	} else if (seemsPure && first === '[') {
		return Parse._promoteArray(valueSource, mode === 'root')
	}

	// Fallback to raw source
	return valueSource
}

/**
 * Parse an object source
 * @param {Parse~Source} source
 * @param {boolean} gentleEnd - whether the object body was ended correctly
 * @returns {Parse~Object}
 * @private
 */
Parse._promoteObject = function (source, gentleEnd) {
	// Extract object body string
	// The raw string is garanteed to start with spaces and a '{'
	// Depending on gentleEnd it may end with or without '}' spaces and ','
	let match = source.raw.match(gentleEnd ? /^(\s*\{)(.*)\}\s*,?$/ : /^(\s*\{)(.*)$/),
		before = match[1],
		body = match[2],
		subSource = {
			type: 'source',
			raw: body,
			cursor: Parse._sliceCursor(source.cursor, before.length, before.length + body.length),
			start: source.start + before.length
		}

	// Read properties
	let properties = [],
		cursor = -1
	while (/\S/.test(subSource.raw)) {
		let hadCursor = subSource.cursor !== -1
		properties.push({
			key: Parse._readKey(subSource),
			value: Parse._readValue(subSource)
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
		cursor: cursor,
		start: source.start
	}
}

/**
 * Parse an array source
 * @param {Parse~Source} source
 * @param {boolean} gentleEnd - whether the array body was ended correctly
 * @returns {Parse~Array}
 * @private
 */
Parse._promoteArray = function (source, gentleEnd) {
	// Extract array body string
	// The raw string is garanteed to start with spaces and a '['
	// Depending on gentleEnd it may end with or without ']' spaces and ','
	let match = source.raw.match(gentleEnd ? /^(\s*\[)(.*)\]\s*,?$/ : /^(\s*\[)(.*)$/),
		before = match[1],
		body = match[2],
		subSource = {
			type: 'source',
			raw: body,
			cursor: Parse._sliceCursor(source.cursor, before.length, before.length + body.length),
			start: source.start + before.length
		}

	// Read values
	let values = [],
		cursor = -1
	while (/\S/.test(subSource.raw)) {
		let hadCursor = subSource.cursor !== -1
		values.push(Parse._readValue(subSource))
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
		cursor: cursor,
		start: source.start
	}
}

/**
 * Extract an object key from the beginning of the string.
 * It is not an error to not use quotes when needed, like: "a.b: 2".
 * Invalid characters between close quotes and ':' are ignore, like 'x' in '"a"x: 2'
 * @param {Parse~Source} source - will be modified
 * @returns {?Parse~Key}
 * @private
 */
Parse._readKey = function (source) {
	let mode = 'start',
		// First char in the key name
		startIndex = -1,
		// First char not in the key name
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
		type: 'key',
		raw: source.raw.slice(0, i + 1),
		start: source.start,
		name: source.raw.slice(startIndex, endIndex),
		cursor: Parse._sliceCursor(source.cursor, startIndex, endIndex)
	}
	source.cursor = Parse._sliceCursor(source.cursor, i + 1, source.raw.length)
	source.raw = source.raw.slice(i + 1)
	source.start += i + 1
	return key
}

/**
 * Compute the new position for the cursor after a slice
 * @param {number} cursor
 * @param {number} start
 * @param {number} end
 * @private
 */
Parse._sliceCursor = function (cursor, start, end) {
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