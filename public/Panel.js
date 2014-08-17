'use strict'

// Global panel manager
var Panel = {}

// Alias for document.getElementById
Panel.get = function (id) {
	if (typeof id === 'object') {
		return id
	} else {
		return document.getElementById(id)
	}
}

// HTML escaping
Panel.escape = function (str) {
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '\\"')
}

// Return the date representation for a given string
// Possible formats:
// now, yesterday (same as 1 day ago), tomorrow (same as 1 day from now)
// N day(s) ago (or d, seconds, s, minutes, min, hours, h, weeks, months, mo, years, yr)
// N day(s) from now (same units as above)
// YYYY-MM-dd or YYYY/MM/dd
Panel.date = function (str) {
	var now = Date.now(),
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
	} else if ((match = str.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/))) {
		return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	} else {
		throw new Error('Invalid format: ' + str)
	}
}

// Make a request
// action is the action name as a string
// body is the object to send (will be JSON-stringifyed)
// callback(result) is called at the end
// result is the value returned by the server or null in case of network error
Panel.request = function (action, body, callback) {
	var ajax = new XMLHttpRequest()
	ajax.open('POST', '/api/' + action)
	ajax.setRequestHeader('Content-Type', 'application/json; charset=utf-8')
	ajax.send(JSON.stringify(body))
	ajax.onload = function () {
		var result = null
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
	array.forEach(function (each) {
		var optionEl = document.createElement('option')
		if (typeof each === 'object') {
			optionEl.value = each[valueKey || 'value']
			optionEl.textContent = each[textKey || 'text']
		} else {
			optionEl.value = optionEl.textContent = each
		}
		selectEl.appendChild(optionEl)
	})
}

// Process the content of a HTML input element as JS
// If soft is true, don't alert parse errors
// Return the JS value or "" if the element is empty
Panel.processJSInEl = function (id, soft) {
	var value = Panel.get(id).value
	var Func = Function
	if (value) {
		try {
			value = new Func('return (' + value + ')')()
		} catch (err) {
			if (!soft) {
				alert(err)
			}
			throw err
		}
	}
	return value
}

// Convert a mongo field path into a better string format
// Example: 'userName' -> 'User Name'
// 'device.token' -> 'Device / Token'
Panel.formatDocPath = function (path) {
	var formattedPath = path.replace(/([a-z])([A-Z])/g, '$1 $2')
	formattedPath = formattedPath.replace(/\.(.)/g, function (_, s) {
		return ' / ' + s.toUpperCase()
	})
	return formattedPath[0].toUpperCase() + formattedPath.substr(1)
}