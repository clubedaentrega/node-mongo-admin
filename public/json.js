/*globals Panel*/
/**
 * @file Declare some mongo special types, like ObjectId
 */
'use strict'

var json = {}

/**
 * @param {string} isoStr
 */
function ISODate(isoStr) {
	return new Date(isoStr)
}

/**
 * new ObjectId() and ObjectId() both have the same effect
 * @class
 * @param {string} id
 * @property {string} $oid
 */
function ObjectId(id) {
	if (!(this instanceof ObjectId)) {
		return new ObjectId(id)
	}
	if (typeof id !== 'string' || !id.match(/^[0-9a-f]{24}$/i)) {
		throw new Error('Expect id to be a 24-hex-char string')
	}
	this.$oid = id
}

ObjectId.prototype.toString = function () {
	return this.$oid
}

/**
 * @class
 * @param {number} type
 * @param {string} binary
 */
function BinData(type, binary) {
	if (!(this instanceof BinData)) {
		return new BinData(type, binary)
	}
	this.$binary = binary
	this.$type = type
}

/**
 * @class
 * @param {string} ref
 * @param {*} id
 */
function DBRef(ref, id) {
	if (!(this instanceof DBRef)) {
		return new DBRef(ref, id)
	}
	this.$ref = ref
	this.$id = id
}

/**
 * @class
 */
function MinKey() {
	if (!(this instanceof MinKey)) {
		return new MinKey()
	}
	this.$minKey = 1
}

/**
 * @class
 */
function MaxKey() {
	if (!(this instanceof MaxKey)) {
		return new MaxKey()
	}
	this.$maxKey = 1
}

/**
 * @class
 * @param {string} numberLong
 */
function Long(numberLong) {
	if (!(this instanceof Long)) {
		return new Long(numberLong)
	}
	this.$numberLong = numberLong
}

/**
 * Reviver function to use with JSON.parse
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
json.reviver = function (key, value) {
	if (value && typeof value === 'object') {
		if (typeof value.$oid === 'string') {
			return new ObjectId(value.$oid)
		} else if (typeof value.$binary === 'string') {
			return new BinData(value.$type, value.$binary)
		} else if (typeof value.$date === 'number') {
			return new Date(value.$date)
		} else if (typeof value.$regex === 'string') {
			return new RegExp(value.$regex, value.$options)
		} else if (typeof value.$ref === 'string') {
			return new DBRef(value.$ref, json.reviver('', value.$id))
		} else if (value.$undefined === true) {
			return undefined
		} else if (value.$minKey === 1) {
			return new MinKey()
		} else if (value.$maxKey === 1) {
			return new MaxKey()
		} else if (typeof value.$numberLong === 'string') {
			return new Long(value.$numberLong)
		} else if (typeof value.$infinity === 'number') {
			return value.$infinity * Infinity
		} else if (value.$nan === 1) {
			return NaN
		} else {
			return value
		}
	}
	return value
}

/**
 * Convert the given value into a string
 * @param {*} value
 * @param {boolean} [html] - false to return plain text, true to return html text
 * @param {boolean} [pretty] - false to return one-line text, true to return multi-line with tabs
 * @param {boolean} [localDate] - show date in local (browser) time (only works if html=true)
 * @param {boolean} [hexBinary] - show binary date in hex (only works if html=true)
 * @returns {string}
 */
json.stringify = function (value, html, pretty, localDate, hexBinary) {
	var finalStr = '',
		indentLevel = 0

	var hasBreak = true
	var getNL = function () {
		if (!pretty) {
			return ''
		}
		var i, nl = '\n'
		for (i = 0; i < indentLevel; i++) {
			nl += '  '
		}
		return nl
	}
	var escapeKey = function (key) {
		if (key.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/)) {
			return key
		} else {
			key = '\'' + key.replace(/'/g, '\\\'') + '\''
			return html ? Panel.escape(key) : key
		}
	}
	var formatDate = function (date) {
		if (!localDate) {
			return date.toISOString()
		}
		var yr = date.getFullYear(),
			mo = n2s(date.getMonth() + 1),
			d = n2s(date.getDate()),
			h = n2s(date.getHours()),
			min = n2s(date.getMinutes()),
			s = n2s(date.getSeconds())

		return yr + '/' + mo + '/' + d + ' ' + h + ':' + min + ':' + s

		function n2s(n) {
			return (n < 10 ? '0' : '') + n
		}
	}
	var formatBinary = function (base64) {
		var hex = '',
			codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
			i, c1, c2, h1, h2, h3
		if (!hexBinary) {
			return base64
		}
		for (i = 0; i < base64.length; i += 2) {
			c1 = codes.indexOf(base64[i])
			c2 = codes.indexOf(base64[i + 1])
			if (c1 === -1) {
				hex = hex.substr(0, hex.length - 1)
			} else if (c2 === -1) {
				hex += (c1 >> 2).toString(16)
			} else {
				h1 = (c1 >> 2).toString(16)
				h2 = (((c1 & 0x3) << 2) + (c2 >> 4)).toString(16)
				h3 = (c2 & 0xF).toString(16)
				hex += h1 + h2 + h3
			}
		}
		return hex
	}
	var pushStr = function (str, breakBefore, breakAfter, className) {
		if (!hasBreak && breakBefore) {
			finalStr += getNL()
		}
		if (className && html) {
			finalStr += '<span class="json-' + className + '">' + str + '</span>'
		} else {
			finalStr += str
		}
		if (breakAfter) {
			finalStr += getNL()
		}
		hasBreak = breakAfter
	}
	var pushJsonValue = function (value, path) {
		var key, needComma, subpath
		if (value === undefined) {
			pushStr(html ? '<em>undefined</em>' : 'undefined', false, false, 'keyword')
		} else if (value === false) {
			pushStr(html ? '<em>false</em>' : 'false', false, false, 'keyword')
		} else if (value === true) {
			pushStr(html ? '<em>true</em>' : 'true', false, false, 'keyword')
		} else if (value === null) {
			pushStr(html ? '<em>null</em>' : 'null', false, false, 'keyword')
		} else if (typeof value === 'number') {
			pushStr(String(value), false, false, 'number')
		} else if (typeof value === 'string') {
			pushStr(html ? Panel.escape(value) : '\'' + value.replace(/'/g, '\\\'') + '\'', false, false, 'string')
		} else if (Array.isArray(value) && !value.length) {
			pushStr('[]')
		} else if (Array.isArray(value)) {
			if (html && indentLevel % 2) {
				pushStr('<span onclick="' +
					'this.nextSibling.style.display=\'\';' +
					'this.style.display=\'none\'' +
					'">[<span class="toggle"></span>]</span>' +
					'<span style="display:none">')
			}
			indentLevel++
			pushStr('[', false, true)
			for (key = 0; key < value.length; key++) {
				if (key) {
					pushStr(',', false, true)
				}
				pushJsonValue(value[key], path)
			}
			indentLevel--
			pushStr(']', true)
			if (html && indentLevel % 2) {
				pushStr('</span>')
			}
		} else if (value instanceof ObjectId) {
			pushStr(html ? value.$oid : 'ObjectId(\'' + value.$oid + '\')', false, false, 'id')
		} else if (value instanceof BinData) {
			if (html) {
				pushStr(formatBinary(value.$binary), false, false, 'binary')
			} else {
				pushStr('BinData(' + value.$type + ', \'' + value.$binary + '\')')
			}
		} else if (value instanceof DBRef) {
			if (html) {
				pushStr('Ref(<span class="json-string">' + Panel.escape(value.$ref) + '</span>, ' + json.stringify(value.$id, true, false) + ')', false, false, 'keyword')
			} else {
				pushStr('DBRef(\'' + value.$ref + '\', ' + json.stringify(value.$id, false, false) + ')')
			}
		} else if (value instanceof MinKey) {
			pushStr('MinKey()', false, false, 'keyword')
		} else if (value instanceof MaxKey) {
			pushStr('MaxKey()', false, false, 'keyword')
		} else if (value instanceof Long) {
			if (html) {
				pushStr('Long(<span class="json-number">' + value.$numberLong + '</span>)', false, false, 'keyword')
			} else {
				pushStr('NumberLong(\'' + value.$numberLong + '\')')
			}
		} else if (value instanceof Date) {
			pushStr(html ? formatDate(value) : 'ISODate(\'' + value.toISOString() + '\')', false, false, 'date')
		} else if (value instanceof RegExp) {
			pushStr(html ? Panel.escape(value) : String(value), false, false, 'regexp')
		} else if (!Object.keys(value).length) {
			pushStr('{}')
		} else {
			if (html && indentLevel % 2) {
				pushStr('<span onclick="' +
					'this.nextSibling.style.display=\'\';' +
					'this.style.display=\'none\'' +
					'">{<span class="toggle"></span>}</span>' +
					'<span style="display:none">')
			}
			indentLevel++
			pushStr('{', false, true)
			needComma = false
			Object.keys(value).sort().forEach(function (key) {
				if (!needComma) {
					needComma = true
				} else {
					pushStr(',', false, true)
				}
				subpath = path ? path + '.' + key : key
				pushStr(escapeKey(key), false, false, 'field')
				pushStr(pretty ? ': ' : ':')
				pushJsonValue(value[key], subpath)
			})

			indentLevel--
			pushStr('}', true)
			if (html && indentLevel % 2) {
				pushStr('</span>')
			}
		}
	}
	pushJsonValue(value, '')

	return finalStr
}

/**
 * Return a treated copy of the given value
 */
json.preParse = function preParse(value) {
	var r, key
	if (value instanceof Date) {
		return {
			$date: value.getTime()
		}
	} else if (value instanceof RegExp) {
		return {
			$regex: value.source,
			$options: (value.global ? 'g' : '') + (value.ignoreCase ? 'i' : '') + (value.multiline ? 'm' : '')
		}
	} else if (value === undefined) {
		return {
			$undefined: true
		}
	} else if (Array.isArray(value)) {
		return value.map(preParse)
	} else if (value && typeof value === 'object' && !value.toJSON) {
		// Simple hash-map
		r = {}
		for (key in value) {
			r[key] = preParse(value[key])
		}
		return r
	} else if (value === Infinity || value === -Infinity) {
		return {
			$infinity: value === Infinity ? 1 : -1
		}
	} else if (Number.isNaN(value)) {
		return {
			$nan: 1
		}
	} else {
		return value
	}
}