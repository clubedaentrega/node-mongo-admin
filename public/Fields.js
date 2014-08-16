'use strict'

var Fields = {}

// Fill an html element with the given object
// el is a HTML element
// obj is a JSON stringify-able object
// focusPath is an optional string with the path (like 'user.email') to add a css class '.focus'
// focusTitle will be the title attribute for the span element
Fields.fillWithJSON = function (el, obj, focusPath, focusTitle) {
	var finalStr = '',
		indentLevel = 0

	var hasBreak = true
	var getNL = function () {
		var i, nl = '\n'
		for (i = 0; i < indentLevel; i++) {
			nl += '  '
		}
		return nl
	}
	var escapeKey = function (key) {
		if (key.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
			return key
		} else {
			return '"' + key.replace(/"/g, '\\"') + '"'
		}
	}
	var pushStr = function (str, breakBefore, breakAfter, className) {
		if (!hasBreak && breakBefore) {
			finalStr += getNL()
		}
		if (className) {
			finalStr += '<span class="' + className + '">' + str + '</span>'
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
			pushStr('<em>false</em>', false, false, 'json-keyword')
		} else if (value === true) {
			pushStr('<em>true</em>', false, false, 'json-keyword')
		} else if (value === null) {
			pushStr('<em>null</em>', false, false, 'json-keyword')
		} else if (typeof value === 'number') {
			pushStr(String(value), false, false, 'json-number')
		} else if (typeof value === 'string') {
			value = '"' + value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '\\"') + '"'
			pushStr(value, false, false, 'json-string')
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
					if (focusPath && subpath === focusPath) {
						focusTitle = focusTitle || ''
						finalStr += '<span class="focus" title="' + focusTitle.replace(/"/g, '&quot;') + '">'
					}
					pushStr(escapeKey(key), false, false, 'json-field')
					pushStr(': ')
					pushJsonValue(value[key], subpath)
					if (focusPath && subpath === focusPath) {
						finalStr += '</span>'
					}
				}
			}
			indentLevel--
			pushStr('}', true)
		}
	}
	pushJsonValue(obj, '')

	el.innerHTML = finalStr
}