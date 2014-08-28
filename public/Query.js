/*globals Panel, ObjectId, BinData, DBRef, MinKey, MaxKey, Long, json*/
'use strict'

var Query = {}

Query.docsByPage = 50

Query.connection = ''
Query.collections = []
Query.specialTypes = [ObjectId, BinData, DBRef, MinKey, MaxKey, Long, Date, RegExp]

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

	Panel.get('query-collections').onchange = Query.onChangeCollection

	Panel.get('query-form').onsubmit = Query.onFormSubmit

	var windowEl = Panel.get('query-window')
	windowEl.onclick = function (event) {
		if (event.target === windowEl) {
			windowEl.style.display = 'none'
		}
	}
}

Query.onChangeConnection = function () {
	var collection = Panel.get('query-collections').value
	Query.connection = Panel.get('query-connections').value
	Panel.request('collections', {
		connection: Query.connection
	}, function (result) {
		Panel.populateSelectWithArray('query-collections', Query.collections = result.collections)

		// Try to recover selected collection
		if (Query.collections.indexOf(collection) !== -1) {
			Panel.get('query-collections').value = collection
		}
	})
}

Query.onChangeCollection = function () {
	Panel.get('query-sort').value = '{_id: -1}'
}

/**
 * @param {Event} [event]
 */
Query.onFormSubmit = function (event) {
	event && event.preventDefault()

	var oid = Query.readId(Panel.get('query-selector').value),
		selector = oid ? oid : Panel.processJSInEl('query-selector'),
		sort = Panel.processJSInEl('query-sort') || {}

	Query.find(Query.connection, Panel.get('query-collections').value, selector || {}, sort, 0)
}

/**
 * @param {string} connection
 * @param {string} collection
 * @param {Object} selector
 * @param {Object} sort
 * @param {number} page
 */
Query.find = function (connection, collection, selector, sort, page) {
	var loadingEl = Panel.get('query-loading')
	loadingEl.style.display = ''
	Panel.get('query-result').classList.add('loading')

	Panel.request('find', {
		connection: connection,
		collection: collection,
		selector: selector,
		limit: Query.docsByPage,
		skip: Query.docsByPage * page,
		sort: sort
	}, function (result) {
		loadingEl.style.display = 'none'
		Panel.get('query-result').classList.remove('loading')
		Panel.get('query-form').scrollIntoView()
		if (!result.error) {
			Query.showResult(result.docs, page, function (page) {
				Query.find(connection, collection, selector, sort, page)
			})
		}
	})
}

/**
 * @param {Object[]} docs
 * @param {number} page
 * @param {Function} findPage
 */
Query.showResult = function (docs, page, findPage) {
	var prevEl = Panel.get('query-prev'),
		nextEl = Panel.get('query-next'),
		pageEl = Panel.get('query-page'),
		prevEl2 = Panel.get('query-prev2'),
		nextEl2 = Panel.get('query-next2'),
		pageEl2 = Panel.get('query-page2'),
		paths = {},
		tree = [],
		treeDepth = 0,
		tableEl = Panel.get('query-result'),
		rowEls = [],
		pathNames, i, th

	prevEl.className = prevEl2.className = !page ? 'prev-off' : 'prev-on'
	prevEl.onmousedown = prevEl2.onmousedown = !page ? null : function (event) {
		event.preventDefault()
		findPage(page - 1)
	}

	nextEl.className = nextEl2.className = docs.length !== Query.docsByPage ? 'next-off' : 'next-on'
	nextEl.onmousedown = nextEl2.onmousedown = docs.length !== Query.docsByPage ? null : function (event) {
		event.preventDefault()
		findPage(page + 1)
	}

	pageEl.textContent = pageEl2.textContent = 'Page ' + (page + 1)

	Panel.get('query-controls2').style.display = docs.length > Query.docsByPage / 2 ? '' : 'none'

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
				Query.specialTypes.indexOf(value.constructor) === -1 &&
				Object.keys(value).length) {
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
	th = Panel.create('th', ' ')
	th.rowSpan = treeDepth
	rowEls[0].appendChild(th)

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
	docs.forEach(function (doc, i) {
		var rowEl = tableEl.insertRow(-1),
			eye = Panel.create('span.eye')
		rowEl.insertCell(-1).appendChild(eye)
		eye.onclick = function () {
			Query.exploreValue(doc, true)
		}
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
		limit: 1,
		skip: 0
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

/**
 * Find all docs that have the given value for the given path
 * @param {string} path
 * @param {*} value
 */
Query.findByPath = function (path, value) {
	if (!/^[a-z_][a-z0-9_$]*$/.test(path)) {
		path = '\'' + path.replace(/'/g, '\\\'') + '\''
	}
	Panel.get('query-selector').value = '{' + path + ': ' + json.stringify(value, false, false) + '}'
	Query.onFormSubmit()
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

	if (value !== undefined) {
		cell.ondblclick = function (event) {
			event.preventDefault()
			Query.findByPath(path, value)
		}
	}
}

/**
 * Open a window to show the given value
 * @param {*} value
 * @param {boolean} [plainText=false]
 */
Query.exploreValue = function (value, plainText) {
	Panel.get('query-window').style.display = ''
	Panel.get('query-json').innerHTML = json.stringify(value, !plainText, true)
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