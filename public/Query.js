/**
 * @file Manage the result display
 */
/*globals Panel, ObjectId, BinData, DBRef, MinKey, MaxKey, Long, json, explore, Menu, Simple*/
'use strict'

var Query = {}

/**
 * Query.collections[connectionName] is a array of collection names
 * @property {Object<Array<string>>}
 */
Query.collections = {}

/**
 * Object paths that are expanded in the result table, displaying subdocs fields
 * @property {string[]}
 */
Query.pathsToExpand = []

/**
 * Store data of current result
 * @property {Array<Object>}
 */
Query.result = null

/**
 * Active connection
 * @readonly
 */
Query.connection = ''

/**
 * Active connection
 * @readonly
 */
Query.collection = ''

Query.specialTypes = [ObjectId, BinData, DBRef, MinKey, MaxKey, Long, Date, RegExp]

Panel.request('collections', {}, function (result) {
	Query.init(result.connections)
})

/**
 * @param {Array<Object>} connections
 * @param {string} connections.$.name
 * @param {Array<string>} connections.$.collections
 */
Query.init = function (connections) {
	var connectionNames = [],
		lastConnection = window.localStorage.getItem('node-mongo-admin-connection')

	connections.forEach(function (connection) {
		Query.collections[connection.name] = connection.collections
		connectionNames.push({
			value: connection.name,
			text: Panel.formatDocPath(connection.name)
		})
	})

	Panel.populateSelectWithArray('query-connections', connectionNames)
	Panel.get('query-connections').onchange = Query.onChangeConnection
	if (lastConnection) {
		Panel.get('query-connections').value = lastConnection
	}
	Query.onChangeConnection()

	Panel.get('query-collections').onchange = Query.onChangeCollection
	Panel.get('query-form').onsubmit = Query.onFormSubmit

	if (window.location.search) {
		Query.executeFromSearch()
	}

	Simple.init()
}

Query.onChangeConnection = function () {
	var collection = Panel.get('query-collections').value,
		collectionNames = [],
		connection = Panel.get('query-connections').value,
		collections = Query.collections[connection]

	Query.connection = connection

	collectionNames = collections.map(function (each) {
		return {
			value: each,
			text: Panel.formatDocPath(each)
		}
	})

	Panel.populateSelectWithArray('query-collections', collectionNames)

	// Try to recover selected collection
	if (collections.indexOf(collection) !== -1) {
		Panel.get('query-collections').value = collection
	} else {
		Query.onChangeCollection()
	}

	// Save to keep on reload
	window.localStorage.setItem('node-mongo-admin-connection', connection)
}

Query.onChangeCollection = function () {
	Query.pathsToExpand = []
	Query.collection = Panel.get('query-collections').value
	Simple.onChangeCollection()
}

/**
 * Change the connection and collection select fields value
 * @param {string} connection
 * @param {string} collection
 */
Query.setCollection = function (connection, collection) {
	var connEl = Panel.get('query-connections'),
		collEl = Panel.get('query-collections')

	if (connEl.value !== connection) {
		connEl.value = connection
		Query.onChangeConnection()
	}

	if (collEl.value !== collection) {
		collEl.value = collection
		Query.onChangeCollection()
	}
}

/**
 * @param {Event} [event]
 * @param {boolean} [dontPushState] whether to push to browser history
 */
Query.onFormSubmit = function (event, dontPushState) {
	event && event.preventDefault()

	Simple.execute()

	if (!dontPushState) {
		// Update page URL
		window.history.pushState(null, '', Query.toSearch())
	}
}

/**
 * Set current layout for a loading state
 * @param {boolean} loading
 */
Query.setLoading = function (loading) {
	if (loading) {
		Panel.get('query-loading').style.display = ''
		Panel.get('query-result').classList.add('loading')
	} else {
		Panel.get('query-loading').style.display = 'none'
		Panel.get('query-result').classList.remove('loading')
		Panel.get('query-form').scrollIntoView()
	}
}

/**
 * @param {Object[]} docs
 * @param {number} [page=0]
 * @param {boolean} [hasMore=false]
 * @param {function(number)} [findPage=null]
 */
Query.showResult = function (docs, page, hasMore, findPage) {
	var prevEl = Panel.get('query-prev'),
		nextEl = Panel.get('query-next'),
		pageEl = Panel.get('query-page'),
		prevEl2 = Panel.get('query-prev2'),
		nextEl2 = Panel.get('query-next2'),
		pageEl2 = Panel.get('query-page2')

	if (findPage) {
		prevEl.className = prevEl2.className = !page ? 'prev-off' : 'prev-on'
		prevEl.onmousedown = prevEl2.onmousedown = !page ? null : function (event) {
			event.preventDefault()
			findPage(page - 1)
		}

		nextEl.className = nextEl2.className = hasMore ? 'next-off' : 'next-on'
		nextEl.onmousedown = nextEl2.onmousedown = hasMore ? null : function (event) {
			event.preventDefault()
			findPage(page + 1)
		}

		pageEl.textContent = pageEl2.textContent = 'Page ' + (page + 1)
		Panel.get('query-controls').style.display = ''
		Panel.get('query-controls2').style.display = docs.length > 10 ? '' : 'none'
	} else {
		Panel.get('query-controls').style.display =
			Panel.get('query-controls2').style.display = 'none'
	}

	Query.result = docs
	Query.populateResultTable()
}

/**
 * Populate result table with data from Query.result
 * Paths in Query.pathsToExpanded are shown in the table
 */
Query.populateResultTable = function () {
	var paths = {},
		tree = [],
		treeDepth = 1,
		tableEl = Panel.get('query-result'),
		rowEls = [],
		docs = Query.result,
		pathNames, i, th

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
				(Object.keys(value).length === 1 ||
					Query.pathsToExpand.indexOf(subpath) !== -1)) {
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
			path, newPath, terminal
		if (typeof treeEl === 'string') {
			path = treeEl
			cell.rowSpan = treeDepth - depth
			cols = 1
			terminal = true
		} else {
			path = treeEl.name
			treeEl.subpaths.forEach(function (each) {
				cols += createHeader(each, depth + 1, prefix + path + '.')
			})
			cell.colSpan = cols
			terminal = false
		}
		rowEls[depth].appendChild(cell)

		newPath = prefix + path
		cell.textContent = Panel.formatDocPath(path)
		cell.oncontextmenu = function (event) {
			var options = {
				'Sort asc': Simple.sortByPath.bind(Query, newPath, 1),
				'Sort desc': Simple.sortByPath.bind(Query, newPath, -1)
			}

			if (!terminal) {
				options['Collapse column'] = function () {
					// Remove this path and subpaths from expand list
					Query.pathsToExpand = Query.pathsToExpand.filter(function (each) {
						return each !== newPath && each.indexOf(newPath + '.') !== 0
					})
					Query.populateResultTable()
				}
			}

			event.preventDefault()
			Menu.show(event, options)
		}
		cell.title = path

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
			explore(doc)
		}
		eye.title = 'Show raw document'
		pathNames.forEach(function (path) {
			Query.fillResultValue(rowEl.insertCell(-1), paths[path][i], path)
		})
	})
}

// Aux function for Query.showResult
Query.fillResultValue = function (cell, value, path) {
	var create = Panel.create

	cell.dataset.path = path
	if (value === undefined) {
		cell.innerHTML = '-'
	} else if (Array.isArray(value)) {
		cell.appendChild(create('span.json-keyword', [
			'Array[',
			create('span.json-number', value.length),
			']'
		]))
		cell.dataset.explore = true
	} else if (typeof value === 'string' && value.length > 20) {
		cell.innerHTML = json.stringify(value.substr(0, 17), true, false) + '&#133;'
		cell.dataset.collapsed = 'string'
		cell.dataset.explore = true
		cell.dataset.value = value
	} else if (value && typeof value === 'object' && value.constructor === Object) {
		cell.appendChild(create('span.json-keyword', [
			'Object{',
			create('span.json-number', Object.keys(value).length),
			'}'
		]))
		cell.dataset.collapsed = 'object'
		cell.dataset.explore = true
	} else {
		cell.innerHTML = json.stringify(value, true, false)
	}

	// Add context menu
	cell.oncontextmenu = Query.openMenu.bind(Query, value, path, cell)
}

/**
 * Construct options for the context menu
 * @param {*} value
 * @param {string} path
 * @param {HTMLElement} cell
 * @param {MouseEvent} event
 */
Query.openMenu = function (value, path, cell, event) {
	var options = {}

	// Explore array/object
	if (cell.dataset.explore) {
		options['Show content'] = function () {
			explore(value)
		}
	}

	// Expand string
	if (cell.dataset.collapsed === 'string') {
		options['Expand this column'] = function () {
			var cells = document.querySelectorAll('#query-result td')
			Array.prototype.forEach.call(cells, function (cell) {
				if (cell.dataset.path === path && cell.dataset.collapsed) {
					cell.dataset.collapsed = false
					cell.innerHTML = json.stringify(cell.dataset.value, true, false)
				}
			})
		}
	}

	// Expand path
	if (cell.dataset.collapsed === 'object') {
		options['Expand this column'] = function () {
			Query.pathsToExpand.push(path)
			Query.populateResultTable()
		}
	}

	// Find
	options['Find by ' + path] = {
		Equal: Simple.findByPath.bind(Simple, path, value),
		Different: Simple.findByPath.bind(Simple, path, value, '$ne'),
		Greater: Simple.findByPath.bind(Simple, path, value, '$gt'),
		Less: Simple.findByPath.bind(Simple, path, value, '$lt'),
		'Greater or equal': Simple.findByPath.bind(Simple, path, value, '$gte'),
		'Less or equal': Simple.findByPath.bind(Simple, path, value, '$lte')
	}

	// Find by id
	if (value instanceof ObjectId && path !== '_id') {
		// Let user search for this id in another collection with a related name
		options['Find by id in'] = Query.getMenuForId(value, path)
	} else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) {
		// Pseudo-id (stored as string)
		options['Find by id in'] = Query.getMenuForId(new ObjectId(value), path)
	}

	// Timestamp from object id
	if (value instanceof ObjectId) {
		options['See timestamp'] = function () {
			// Convert the first 4 bytes to Unix Timestamp then alert it
			var time = parseInt(String(value).substr(0, 8), 16),
				date = new Date(time * 1000),
				iso = date.toISOString().replace('.000', ''),
				local = String(date)

			alert('Id:\n\t' + value + '\nDatetime:\n\t' + iso + '\nLocal time:\n\t' + local)
		}
	}

	event.preventDefault()
	Menu.show(event, options)
}

/**
 * Construct the find-by-id context menu
 * @param {ObjectId} value
 * @param {string} path
 * @returns {Object<Function>}
 */
Query.getMenuForId = function (value, path) {
	var options = {},
		pathParts = path.split('.')

	Object.keys(Query.collections).forEach(function (conn) {
		Query.collections[conn].forEach(function (coll) {
			// For each collection, test if match with the path
			var fn, conn2, match = pathParts.some(function (part) {
				if (part.substr(-2) === 'Id' || part.substr(-2) === 'ID') {
					part = part.substr(0, part.length - 2)
				}
				return coll.toLowerCase().indexOf(part.toLowerCase()) !== -1
			})

			if (match) {
				fn = function () {
					Simple.findById(conn, coll, value)
				}

				if (conn === Query.connection) {
					options[Panel.formatDocPath(coll)] = fn
				} else {
					// Submenu for other connection
					// appending empty space is a hack to avoid name colission
					conn2 = Panel.formatDocPath(conn) + '\u200b'
					options[conn2] = options[conn2] || {}
					options[conn2][Panel.formatDocPath(coll)] = fn
				}
			}
		})
	})

	return options
}

/**
 * Convert the current query to a URL search component
 */
Query.toSearch = function () {
	var parts = ['simple', Query.connection, Query.collection].concat(Simple.toSearchParts())

	return '?' + parts.map(encodeURIComponent).join('&')
}

/**
 * Do a find operation based on a search URL component (generated by Query.toSearch)
 */
Query.executeFromSearch = function () {
	var search = window.location.search
	if (search[0] !== '?') {
		return
	}

	var parts = search.substr(1).split('&').map(decodeURIComponent),
		// mode = parts[0], ignore for now
		connection = parts[1],
		collection = parts[2]

	Query.setCollection(connection, collection)
	Simple.executeFromSearchParts.apply(Simple, parts.slice(3))
}

window.addEventListener('popstate', function () {
	Query.executeFromSearch()
})