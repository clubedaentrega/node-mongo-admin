/* global json*/
'use strict'

// Global panel manager
let Panel = {}

/**
 * @param {string|HTMLElement} id
 * @returns {HTMLElement}
 */
Panel.get = function (id) {
	if (typeof id === 'object') {
		return id
	}
	return document.getElementById(id)

}

/**
 * Like document.querySelectorAll, but returns an Array
 * @param {string} selector
 * @param {HTMLElement} [root=document]
 * @returns {Array<HTMLElement>}
 */
Panel.getAll = function (selector, root) {
	root = root || document
	return [].slice.call(root.querySelectorAll(selector))
}

/**
 * @param {string|HTMLElement} id
 * @param {string} [newValue] - if present, set the input value
 * @returns {string} - the input value
 */
Panel.value = function (id, newValue) {
	if (newValue !== undefined) {
		return (Panel.get(id).value = newValue)
	}
	return Panel.get(id).value
}

/**
 * Create and return an HTML tag
 * @param {string} tag Tag name + class names + attributes, like: 'input.big[type=email][required]'
 * @param {(Array|string)} [content] The text content or an array of child elements
 */
Panel.create = function (tag, content) {
	let parts = tag.split(/(\[.*?\])|\.(.*?)/).filter(Boolean),
		el = document.createElement(parts[0]),
		i, att, pos

	// Attributes and classes
	for (i = 1; i < parts.length; i++) {
		if (parts[i][0] === '[') {
			// Attribute
			att = parts[i].substr(1, parts[i].length - 2)
			if ((pos = att.indexOf('=')) === -1) {
				el.setAttribute(att, '')
			} else {
				el.setAttribute(att.substr(0, pos), att.substr(pos + 1))
			}
		} else {
			// Class
			el.classList.add(parts[i])
		}
	}

	// Add content
	if (Array.isArray(content)) {
		content.forEach(each => {
			if (typeof each === 'object') {
				el.appendChild(each)
			} else {
				el.appendChild(document.createTextNode(each))
			}
		})
	} else if (content !== undefined) {
		el.textContent = String(content)
	}

	return el
}

// HTML escaping
Panel.escape = function (str) {
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/'/g, '&#39;')
		.replace(/"/g, '&quot;')
}

// Return the date representation for a given string
// Possible formats:
// now, yesterday (same as 1 day ago), tomorrow (same as 1 day from now)
// N day(s) ago (or d, seconds, s, minutes, min, hours, h, weeks, months, mo, years, yr)
// N day(s) from now (same units as above)
// YYYY-MM-dd or YYYY/MM/dd
Panel.date = function (str) {
	let now = Date.now(),
		S = 1e3,
		MIN = 60 * S,
		H = 60 * MIN,
		D = 24 * H,
		WEEK = 7 * D,
		MO = 30.4375 * D,
		YR = 12 * MO,
		match, unit
	if (str === 'today') {
		return new Date()
	} else if (str === 'yesterday') {
		return new Date(now - D)
	} else if (str === 'tomorrow') {
		return new Date(now + D)
	} else if ((match = str.match(/^(\d+) (\w+) (ago|from now)$/))) {
		unit = match[2]
		if (unit === 's' || unit === 'second' || unit === 'seconds') {
			unit = S
		} else if (unit === 'min' || unit === 'minute' || unit === 'minutes') {
			unit = MIN
		} else if (unit === 'h' || unit === 'hour' || unit === 'hours') {
			unit = H
		} else if (unit === 'd' || unit === 'day' || unit === 'days') {
			unit = D
		} else if (unit === 'week' || unit === 'weeks') {
			unit = WEEK
		} else if (unit === 'mo' || unit === 'month' || unit === 'months') {
			unit = MO
		} else if (unit === 'yr' || unit === 'year' || unit === 'years') {
			unit = YR
		} else {
			throw new Error('Unit not found: ' + unit)
		}
		return new Date(now + (match[3] === 'ago' ? -1 : 1) * Number(match[1]) * unit)
	} else if ((match = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/))) {
		return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	}

	throw new Error('Invalid format: ' + str)
}

// Make a request
// action is the action name as a string
// body is the object to send (will be JSON-stringifyed)
// callback(result) is called at the end
// result is the value returned by the server or null in case of network error
Panel.request = function (action, body, callback) {
	let ajax = new XMLHttpRequest()
	ajax.open('POST', '/api/' + action)
	ajax.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
	ajax.send(JSON.stringify(json.preParse(body)))
	ajax.onload = function () {
		let result = null
		if (ajax.status !== 200) {
			return callback(null)
		}
		try {
			result = JSON.parse(ajax.responseText, json.reviver)
			if (result.error) {
				alert('Error ' + result.error.code + ': ' + result.error.message)
			}
		} catch (e) {
			alert('Invalid JSON: ' + e)
		}
		callback(result)
	}
	ajax.onerror = function () {
		alert('Request failed')
		callback(null)
	}
}

// Populate a <select> element with the given array of strings
// array can be an array of strings or objects
// if it's an array of strings, valueKey and textKey are ignored
// if it's an array of objects, valueKey and textKey must be strings (default: 'value' and 'text')
Panel.populateSelectWithArray = function (selectEl, array, valueKey, textKey) {
	selectEl = Panel.get(selectEl)
	selectEl.innerHTML = ''
	array.forEach(each => {
		let optionEl = document.createElement('option')
		if (typeof each === 'object') {
			optionEl.value = each[valueKey || 'value']
			optionEl.textContent = each[textKey || 'text']
		} else {
			optionEl.value = optionEl.textContent = each
		}
		selectEl.appendChild(optionEl)
	})
}

/**
 * Process the content of a HTML input element as JS
 * @param {string|HTMLElement} id
 * @param {boolean} [soft] - if true, don't alert parse errors
 * @param {boolean} [implicitObject] - embbed field value in '{...}' before parsing
 * @returns {*} a JS value or "" if the element is empty
 * @throws if invalid syntax
 */
Panel.processJSInEl = function (id, soft, implicitObject) {
	let value = Panel.value(id)
	let Func = Function
	if (value) {
		try {
			value = new Func('return (' + (implicitObject ? '{' + value + '}' : value) + ')')()
		} catch (err) {
			if (!soft) {
				alert(err)
			}
			throw err
		}

		if (value && typeof value === 'object') {
			value.__raw = Panel.value(id)
		}
	}
	return value
}

// Convert a mongo field path into a better string format
// Example: 'userName' -> 'User Name'
// 'device.token' -> 'Device / Token'
Panel.formatDocPath = function (path) {
	let formattedPath = path.replace(/([a-z])([A-Z])/g, '$1 $2')
	formattedPath = formattedPath.replace(/\.(.)/g, (_, s) => ' / ' + s.toUpperCase())
	return formattedPath[0].toUpperCase() + formattedPath.substr(1)
}