/*globals Panel, ObjectId, Binary, DBRef, MinKey, MaxKey, Long, json*/
'use strict'

var Query = {}

Query.connection = ''
Query.collections = []
Query.specialTypes = [ObjectId, Binary, DBRef, MinKey, MaxKey, Long, Date, RegExp]

Panel.request('connections', {}, function (result) {
	Query.init(result.connections)
})

Query.init = function (connections) {
	Panel.populateSelectWithArray('query-connections', connections.map(function (each) {
		return {
			value: each,
			text: Panel.formatDocPath(each)
		}
	}))
	Panel.get('query-connections').onchange = Query.onChangeConnection
	Query.onChangeConnection()

	Panel.get('query-selector').oninput = function () {
		Panel.get('query-find').textContent = Query.readId(this.value) ? 'findById' : 'find'
	}

	Panel.get('query-form').onsubmit = Query.onFormSubmit

	var windowEl = Panel.get('query-window')
	windowEl.onclick = function (event) {
		if (event.target === windowEl) {
			windowEl.style.display = 'none'
		}
	}
}

Query.onChangeConnection = function () {
	Query.connection = Panel.get('query-connections').value
	Panel.request('collections', {
		connection: Query.connection
	}, function (result) {
		Panel.populateSelectWithArray('query-collections', Query.collections = result.collections)
	})
}

Query.onFormSubmit = function (event) {
	var loadingEl, oid, selector
	event.preventDefault()

	loadingEl = Panel.get('query-loading')
	loadingEl.style.display = ''
	Panel.get('query-result').classList.add('loading')

	oid = Query.readId(Panel.get('query-selector').value)
	selector = oid ? oid : Panel.processJSInEl('query-selector')

	Panel.request('find', {
		connection: Query.connection,
		collection: Panel.get('query-collections').value,
		selector: selector || {},
		limit: Number(Panel.get('query-limit').value),
		sort: Panel.processJSInEl('query-sort') || {}
	}, function (result) {
		loadingEl.style.display = 'none'
		Panel.get('query-result').classList.remove('loading')
		if (!result.error) {
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
			subpath = path ? path + '.' + key : key
			value = subdoc[key]

			if (value &&
				typeof value === 'object' &&
				!Array.isArray(value) &&
				Query.specialTypes.indexOf(value.constructor) === -1) {
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
		connection: Query.connection,
		collection: collection,
		selector: {
			_id: id
		},
		limit: 1
	}, function (result) {
		if (result.error) {
			return
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
	var create = Panel.create

	if (value === undefined) {
		cell.innerHTML = '-'
	} else if (Array.isArray(value)) {
		cell.appendChild(create('span.json-keyword', [
			'Array[',
			create('span.json-number', value.length),
			']'
		]))
		if (value.length) {
			cell.onclick = function () {
				Query.exploreValue(value)
			}
			cell.style.cursor = 'pointer'
			cell.title = 'Click to explore'
		}
	} else if (typeof value === 'string' && value.length > 20) {
		cell.innerHTML = json.stringify(value.substr(0, 17), true, false) + '&#133;'
		cell.onclick = function () {
			this.innerHTML = json.stringify(value, true, false)
		}
		cell.style.cursor = 'pointer'
		cell.title = 'Click to expand'
	} else {
		cell.innerHTML = json.stringify(value, true, false)
	}

	if (value instanceof ObjectId && Query.collections.indexOf(path) !== -1) {
		cell.onclick = function () {
			Query.exploreValue('Loading...')
			Query.findById(path, value)
		}
		cell.style.cursor = 'pointer'
		cell.title = 'Click to see related value'
	}
}

// Open a window to show the given value
Query.exploreValue = function (value) {
	Panel.get('query-window').style.display = ''
	Panel.get('query-json').innerHTML = json.stringify(value, true, true)
}

/**
 * Try to read an object id from the string
 * Valid examples: 53f0175172b3dd4af22d1972, "53f0175172b3dd4af22d1972", '53f0175172b3dd4af22d1972'
 * @param {string} str
 * @returns {?ObjectId} null if not valid syntax
 */
Query.readId = function (str) {
	var match = str.match(/^(["']?)([0-9a-f]{24})\1$/)
	return match ? new ObjectId(match[2]) : null
}