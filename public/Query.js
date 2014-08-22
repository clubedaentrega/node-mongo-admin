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
	var paths = {},
		tree = [],
		treeDepth = 0,
		tableEl = Panel.get('query-result'),
		rowEls = [],
		pathNames, i

	Panel.get('query-count').textContent = docs.length === 1 ? '1 result' : docs.length + ' results'

	/**
	 * @param {Array} tree
	 * @param {string[]} path
	 * @param {number} depth
	 */
	var addToTree = function (tree, path, depth) {
		var pathPart = path[depth],
			i

		treeDepth = Math.max(treeDepth, depth + 1)
		if (depth === path.length - 1) {
			tree.push(pathPart)
		} else {
			for (i = 0; i < tree.length; i++) {
				if (tree[i].name === pathPart) {
					return addToTree(tree[i].subpaths, path, depth + 1)
				}
			}
			tree.push({
				name: pathPart,
				subpaths: []
			})
			addToTree(tree[i].subpaths, path, depth + 1)
		}
	}

	/**
	 * Group by path
	 * @param {Object} subdoc
	 * @param {string} path
	 * @param {number} i
	 */
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
		addSubDoc(doc, '', i, tree)
	})

	pathNames = Object.keys(paths).sort()
	pathNames.forEach(function (path) {
		addToTree(tree, path.split('.'), 0)
	})
	tableEl.innerHTML = ''
	for (i = 0; i < treeDepth; i++) {
		rowEls[i] = tableEl.insertRow(-1)
	}

	/**
	 * @param {(string|Object)} treeEl
	 * @param {number} depth
	 * @param {string} prefix
	 * @returns {number} number of child fields
	 */
	var createHeader = function (treeEl, depth, prefix) {
		var cell = Panel.create('th'),
			cols = 0,
			path, newPath
		if (typeof treeEl === 'string') {
			path = treeEl
			cell.rowSpan = treeDepth - depth
			cols = 1
		} else {
			path = treeEl.name
			treeEl.subpaths.forEach(function (each) {
				cols += createHeader(each, depth + 1, prefix + path + '.')
			})
			cell.colSpan = cols
		}
		rowEls[depth].appendChild(cell)

		newPath = prefix + path
		cell.textContent = Panel.formatDocPath(path)
		cell.title = newPath + ' (click to sort)'
		cell.onclick = function () {
			var sort, sortEl
			if (newPath.match(/^[a-z_][a-z0-9_]*$/i)) {
				sort = '{' + newPath + ': -1}'
			} else {
				sort = '{\'' + newPath.replace(/'/g, '\\\'') + '\': -1}'
			}
			sortEl = Panel.get('query-sort')
			sortEl.value = sortEl.value === sort ? sort.substr(0, sort.length - 3) + '1}' : sort
			Panel.get('query-execute').click()
		}
		cell.style.cursor = 'pointer'

		return cols
	}
	tree.forEach(function (each) {
		createHeader(each, 0, '')
	})

	// Build the table
	docs.forEach(function (_, i) {
		var rowEl = tableEl.insertRow(-1)
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