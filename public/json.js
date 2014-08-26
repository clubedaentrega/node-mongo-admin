/*globals Panel*/
/**
 * @file Declare some mongo special types, like ObjectId
 */
'use strict'

var json = {}

Date.prototype.toJSON = function () {
	return {
		$date: this.getTime()
	}
}

RegExp.prototype.toJSON = function () {
	return {
		$regex: this.source,
		$options: (this.global ? 'g' : '') + (this.ignoreCase ? 'i' : '') + (this.multiline ? 'm' : '')
	}
}

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
		} else {
			return value
		}
	}
	return value
}

/**
 * Convert the given value into a string
 * @param {*} value
 * @param {boolean} html False to return plain text, true to return html text
 * @param {boolean} pretty False to return one-line text, true to return multi-line with tabs
 * @returns {string}
 */
json.stringify = function (value, html, pretty) {
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
			key = '"' + key.replace(/"/g, '\\"') + '"'
			return html ? Panel.escape(key) : key
		}
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
		if (value === false) {
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
		} else if (value instanceof ObjectId) {
			pushStr(html ? value.$oid : 'ObjectId("' + value.$oid + '")', false, false, 'id')
		} else if (value instanceof BinData) {
			if (html) {
				pushStr('Bin(<span class="json-binary">' + value.$binary + '</span>)', false, false, 'keyword')
			} else {
				pushStr('BinData(' + value.$type + ', "' + value.$binary + '")')
			}
		} else if (value instanceof DBRef) {
			if (html) {
				pushStr('Ref(<span class="json-string">' + Panel.escape(value.$ref) + '</span>, ' + json.stringify(value.$id, true, false) + ')', false, false, 'keyword')
			} else {
				pushStr('DBRef("' + value.$ref + '", ' + json.stringify(value.$id, false, false) + ')')
			}
		} else if (value instanceof MinKey) {
			pushStr('MinKey()', false, false, 'keyword')
		} else if (value instanceof MaxKey) {
			pushStr('MaxKey()', false, false, 'keyword')
		} else if (value instanceof Long) {
			if (html) {
				pushStr('Long(<span class="json-number">' + value.$numberLong + '</span>)', false, false, 'keyword')
			} else {
				pushStr('NumberLong("' + value.$numberLong + '")')
			}
		} else if (value instanceof Date) {
			pushStr(html ? value.toISOString() : 'ISODate("' + value.toISOString() + '")', false, false, 'date')
		} else if (value instanceof RegExp) {
			pushStr(html ? Panel.escape(value) : String(value), false, false, 'regexp')
		} else if (!Object.keys(value).length) {
			pushStr('{}')
		} else {
			indentLevel++
			pushStr('{', false, true)
			needComma = false
			for (key in value) {
				if (value.hasOwnProperty(key)) {
					if (!needComma) {
						needComma = true
					} else {
						pushStr(',', false, true)
					}
					subpath = path ? path + '.' + key : key
					pushStr(escapeKey(key), false, false, 'field')
					pushStr(pretty ? ': ' : ':')
					pushJsonValue(value[key], subpath)
				}
			}
			indentLevel--
			pushStr('}', true)
		}
	}
	pushJsonValue(value, '')

	return finalStr
}