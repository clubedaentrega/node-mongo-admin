/*globals Panel, Fields*/
'use strict'

var Query = {}

Query.collections = []

Panel.request('collections', {}, function (result) {
	Query.collections = result.collections
	Query.init()
})

Query.init = function () {
	Panel.populateSelectWithArray('query-collections', Query.collections)

	Panel.get('query-form').onsubmit = Query.onFormSubmit
	var windowEl = Panel.get('query-window')
	windowEl.onclick = function (event) {
		if (event.target === windowEl) {
			windowEl.style.display = 'none'
		}
	}
}

Query.onFormSubmit = function (event) {
	event.preventDefault()
	var loadingEl = Panel.get('query-loading')
	loadingEl.style.display = ''
	Panel.get('query-result').classList.add('loading')

	var selector = Panel.processJSInEl('query-selector')
	var sort = Panel.processJSInEl('query-sort')

	Panel.request('find', {
		collection: Panel.get('query-collections').value,
		selector: JSON.stringify(selector),
		limit: Number(Panel.get('query-limit').value),
		sort: JSON.stringify(sort)
	}, function (result) {
		loadingEl.style.display = 'none'
		Panel.get('query-result').classList.remove('loading')
		if (result.error) {
			alert('Error: ' + result.error.message)
		} else {
			Query.showResult(result.docs)
		}
	})
}

Query.showResult = function (docs) {
	var paths = {}

	Panel.get('query-count').textContent = docs.length === 1 ? '1 result' : docs.length + ' results'

	// Group by path
	var addSubDoc = function (subdoc, path, i) {
		var key, subpath, value
		for (key in subdoc) {
			if (subdoc.hasOwnProperty(key)) {
				subpath = path ? path + '.' + key : key
				value = subdoc[key]

				if (typeof value === 'object' && !Array.isArray(value)) {
					addSubDoc(value, subpath, i)
				} else {
					// Primitive value
					if (!(subpath in paths)) {
						// New result path
						paths[subpath] = []
					}
					paths[subpath][i] = value
				}
			}
		}
	}

	docs.forEach(function (doc, i) {
		addSubDoc(doc, '', i)
	})

	// Build the table header
	var pathNames = Object.keys(paths).sort()
	var tableEl = Panel.get('query-result'),
		rowEl
	tableEl.innerHTML = ''
	rowEl = tableEl.insertRow(-1)
	pathNames.forEach(function (path) {
		var cellEl = document.createElement('th')
		rowEl.appendChild(cellEl)
		cellEl.title = path + ' (click to sort)'
		cellEl.onclick = function () {
			var sort, sortEl
			if (path.match(/^[a-z_][a-z0-9_]*$/i)) {
				sort = '{' + path + ': -1}'
			} else {
				sort = '{"' + path.replace(/"/g, '\\"') + '": -1}'
			}
			sortEl = Panel.get('query-sort')
			sortEl.value = sortEl.value === sort ? sort.substr(0, sort.length - 3) + '1}' : sort
			Panel.get('query-execute').click()
		}
		cellEl.style.cursor = 'pointer'
		cellEl.textContent = Panel.formatDocPath(path)
	})

	// Build the table
	docs.forEach(function (_, i) {
		rowEl = tableEl.insertRow(-1)
		pathNames.forEach(function (path) {
			Query._fillResultValue(rowEl.insertCell(-1), paths[path][i], path)
		})
	})
}

// Run a simple findById query and show the result in the pop-over window
Query.findById = function (collection, id) {
	Panel.request('find', {
		collection: collection,
		selector: JSON.stringify({
			_id: id
		}),
		limit: 1,
		sort: ''
	}, function (result) {
		if (result.error) {
			alert('Error: ' + result.error.message)
		} else if (result.docs.length === 0) {
			Query.exploreValue(null)
		} else if (result.docs.length === 1) {
			Query.exploreValue(result.docs[0])
		} else {
			Query.exploreValue(result.docs)
		}
	})
}

// Aux function for Query.showResult
Query._fillResultValue = function (cell, value, path) {
	var str, originalValue, i, num
	if (value === true) {
		cell.innerHTML = '<span class="json-keyword">true</span>'
	} else if (value === false) {
		cell.innerHTML = '<span class="json-keyword">false</span>'
	} else if (value === null) {
		cell.innerHTML = '<span class="json-keyword">null</span>'
	} else if (value === undefined) {
		cell.textContent = '-'
	} else if (typeof value === 'string') {
		if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)) {
			// Date
			originalValue = value
			value = Date.now() - new Date(value).getTime()
			str = value > 0 ? ' ago' : ' from now'
			value = Math.abs(value)
			if (value < 1e3) {
				cell.textContent = 'Right now'
			} else if (value < 60e3) {
				value = Math.floor(value / 1e3)
				cell.textContent = value + ' second' + (value > 1 ? 's' : '') + str
			} else if (value < 60 * 60e3) {
				value = Math.floor(value / 60e3)
				cell.textContent = value + ' minute' + (value > 1 ? 's' : '') + str
			} else if (value < 24 * 60 * 60e3) {
				value = Math.floor(value / 3600e3)
				cell.textContent = value + ' hour' + (value > 1 ? 's' : '') + str
			} else if (value < 30.4375 * 24 * 60 * 60e3) {
				value = Math.floor(value / 86400e3)
				cell.textContent = value + ' day' + (value > 1 ? 's' : '') + str
			} else if (value < 12 * 30.4375 * 24 * 60 * 60e3) {
				value = Math.floor(value / 2629800e3)
				cell.textContent = value + ' month' + (value > 1 ? 's' : '') + str
			} else {
				value = Math.floor(value / 31557600e3)
				cell.textContent = value + ' year' + (value > 1 ? 's' : '') + str
			}
			cell.onclick = function () {
				alert(originalValue)
			}
			cell.style.cursor = 'pointer'
			cell.title = 'Click to see original value'
		} else if (value.match(/^[0-9a-f]{24}$/) && Query.models.indexOf(path) !== -1) {
			cell.innerHTML = '<span class="json-field">' + value + '</span>'
			cell.onclick = function () {
				Query.exploreValue('Loading...')
				Query.findById(path, value)
			}
			cell.style.cursor = 'pointer'
			cell.title = 'Click to see related value'
		} else {
			value = '"' + value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '\\"') + '"'
			cell.innerHTML = '<div class="json-string">' + value + '</div>'
		}
	} else if (typeof value === 'number') {
		cell.innerHTML = '<span class="json-number">' + value + '</span>'
	} else if (Array.isArray(value)) {
		cell.innerHTML = '<span class="json-field">Array[' + value.length + ']</span>'
		if (value.length) {
			cell.onclick = function () {
				Query.exploreValue(value)
			}
			cell.style.cursor = 'pointer'
			cell.title = 'Click to explore'
		}
	} else {
		cell.textContent = '???'
	}
}

// Open a window to show the given value
Query.exploreValue = function (value) {
	Panel.get('query-window').style.display = ''
	Fields.fillWithJSON(Panel.get('query-json'), value)
}