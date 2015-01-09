/**
 * @file Manage the result display
 */
/*globals Panel, ObjectId, BinData, DBRef, MinKey, MaxKey, Long, json, explore, Menu, Export, Storage, Populate, Populated*/
'use strict'

var Query = {}

/**
 * Query.collections[connectionName] is a array of collection names
 * @property {Object<Array<string>>}
 */
Query.collections = {}

/**
 * Object paths that are expanded in the result table, displaying subdocs fields
 * @property {Storage}
 */
Query.expandedPaths = new Storage('expand')

/**
 * Store data of current result
 * @property {Array<Object>}
 */
Query.result = null

/**
 * Active connection
 * @property {string}
 * @readonly
 */
Query.connection = ''

/**
 * Active collection
 * @property {string}
 * @readonly
 */
Query.collection = ''

/**
 * @typedef {Object} Mode
 * @property {string} name
 * @propert {function()} execute
 * @propert {function():Array} toSearchParts
 * @propert {function(...*)} executeFromSearchParts
 * @propert {function()} [init]
 * @propert {boolean} [default=false]
 * @propert {function()} [onChangeCollection]
 * @propert {function(*,string,HTMLElement,Object)} [processCellMenu]
 * @propert {function(*,string,HTMLElement,Object)} [processGlobalCellMenu]
 * @propert {function(string,Object)} [processHeadMenu]
 */

/**
 * Active mode
 * @property {Mode}
 */
Query.mode = null

/**
 * Registered modes
 * @property {Array<Mode>}
 */
Query.modes = []

Query.specialTypes = [ObjectId, BinData, DBRef, MinKey, MaxKey, Long, Date, RegExp]

/**
 * Selected rows
 * @property {Array<HTMLElement>}
 */
Query.selection = []

/**
 * Hidden columns
 * @property {Storage}
 */
Query.hiddenPaths = new Storage('hide')

window.addEventListener('load', function () {
	Panel.request('collections', {}, function (result) {
		Query.init(result.connections)
	})
})

/**
 * @param {Mode} mode
 */
Query.registerMode = function (mode) {
	Query.modes.push(mode)
}

/**
 * @param {Array<Object>} connections
 * @param {string} connections.$.name
 * @param {Array<string>} connections.$.collections
 */
Query.init = function (connections) {
	var connectionNames = [],
		lastConnection = window.localStorage.getItem('node-mongo-admin-connection'),
		initialMode

	// Setup modes
	Query.modes.forEach(function (mode) {
		var btEl = Panel.create('input[type=button]')
		btEl.value = Panel.formatDocPath(mode.name)
		btEl.id = 'bt-' + mode.name
		btEl.onclick = Query.setMode.bind(Query, mode)
		Panel.get('mode-buttons').appendChild(btEl)
		if (mode.default) {
			initialMode = mode
		}
	})

	Query.setMode(initialMode)

	connections.forEach(function (connection) {
		Query.collections[connection.name] = connection.collections
		connectionNames.push({
			value: connection.name,
			text: Panel.formatDocPath(connection.name)
		})
	})

	Query.modes.forEach(function (mode) {
		if (mode.init) {
			mode.init()
		}
	})

	Panel.populateSelectWithArray('query-connections', connectionNames)
	Panel.get('query-connections').onchange = Query.onChangeConnection
	if (lastConnection) {
		Panel.value('query-connections', lastConnection)
	}
	Query.onChangeConnection()

	Panel.get('query-collections').onchange = Query.onChangeCollection
	Panel.get('query-form').onsubmit = Query.onFormSubmit
	Panel.get('export').onclick = Query.export

	if (window.location.search) {
		Query.executeFromSearch()
	}
}

Query.onChangeConnection = function () {
	var collection = Panel.value('query-collections'),
		collectionNames = [],
		connection = Panel.value('query-connections'),
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
		Panel.value('query-collections', collection)
	} else {
		Query.onChangeCollection()
	}

	// Save to keep on reload
	window.localStorage.setItem('node-mongo-admin-connection', connection)
}

Query.onChangeCollection = function () {
	Query.collection = Panel.value('query-collections')
	if (Query.mode.onChangeCollection) {
		Query.mode.onChangeCollection()
	}
}

/**
 * Export the current result set
 */
Query.export = function () {
	var title, url

	title = Panel.formatDocPath(Query.mode.name) +
		' query on ' +
		Panel.formatDocPath(Query.connection + '.' + Query.collection)
	url = Export.export(Query.result, title)
	window.open(url)
	window.URL.revokeObjectURL(url)
}

/**
 * @param {Mode} mode
 */
Query.setMode = function (mode) {
	Query.mode = mode
	Query.modes.forEach(function (each) {
		Panel.get('bt-' + each.name).disabled = each === mode
		Panel.get('query-' + each.name).style.display = each === mode ? '' : 'none'
	})
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

	Query.mode.execute()

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

		nextEl.className = nextEl2.className = !hasMore ? 'next-off' : 'next-on'
		nextEl.onmousedown = nextEl2.onmousedown = !hasMore ? null : function (event) {
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

	Panel.get('export').style.display = docs.length ? '' : 'none'

	Query.result = docs
	Query.populateResultTable()

	Populate.runAll(Query.connection, Query.collection)
}

/**
 * Populate result table with data from Query.result
 * Paths in Query.expandedPaths are shown in the table
 */
Query.populateResultTable = function () {
	var paths = {},
		tree = [],
		treeDepth = 1,
		tableEl = Panel.get('query-result'),
		rowEls = [],
		docs = Query.result,
		conn = Query.connection,
		coll = Query.collection,
		pathsToHide = Query.hiddenPaths.getArray(conn, coll),
		pathsToExpand = Query.expandedPaths.getArray(conn, coll),
		populatedPaths = Populate.getPaths(conn, coll),
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
	 * @param {boolean} populated
	 * @param {*} original - original value, before population
	 */
	var addSubDoc = function (subdoc, path, i, populated, original) {
		var key, subpath, value
		for (key in subdoc) {
			subpath = path ? path + '.' + key : key
			value = subdoc[key]
			if (pathsToHide.indexOf(subpath) !== -1) {
				continue
			}
			
			if (value instanceof Populated) {
				populated = true
				original = value.original
				value = value.display
			}

			if (value &&
				typeof value === 'object' &&
				!Array.isArray(value) &&
				Query.specialTypes.indexOf(value.constructor) === -1 &&
				(Object.keys(value).length === 1 ||
					pathsToExpand.indexOf(subpath) !== -1)) {
				addSubDoc(value, subpath, i, populated, original)
			} else {
				// Primitive value
				if (!(subpath in paths)) {
					// New result path
					paths[subpath] = []
				}
				paths[subpath][i] = populated ? new Populated(original, value) : value
			}
		}
	}

	Panel.get('query-unhide-p').style.display = pathsToHide.length ? '' : 'none'
	Panel.get('query-unhide').onclick = function () {
		pathsToHide.clear()
		Query.populateResultTable()
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
	Query.selection = []

	/**
	 * @param {(string|Object)} treeEl
	 * @param {number} depth
	 * @param {string} prefix
	 * @returns {number} number of child fields
	 */
	var createHeader = function (treeEl, depth, prefix) {
		var cell = Panel.create('th'),
			cols = 0,
			path, newPath, leaf
		if (typeof treeEl === 'string') {
			path = treeEl
			cell.rowSpan = treeDepth - depth
			cols = 1
			leaf = true
		} else {
			path = treeEl.name
			treeEl.subpaths.forEach(function (each) {
				cols += createHeader(each, depth + 1, prefix + path + '.')
			})
			cell.colSpan = cols
			leaf = false
		}
		rowEls[depth].appendChild(cell)

		newPath = prefix + path
		cell.textContent = Panel.formatDocPath(path)
		cell.oncontextmenu = function (event) {
			var options = {}

			if (!leaf) {
				options['Collapse column'] = function () {
					// Remove this path and subpaths from expand list
					pathsToExpand.set(pathsToExpand.filter(function (each) {
						return each !== newPath && each.indexOf(newPath + '.') !== 0
					}))
					Query.populateResultTable()
				}
			}

			options['Show field name'] = function () {
				explore(newPath)
			}

			options['Hide this column'] = function () {
				pathsToHide.pushAndSave(newPath)
				Query.populateResultTable()
			}

			// Add custom buttons
			Query.mode.processHeadMenu && Query.mode.processHeadMenu(newPath, options)

			// Show it
			event.preventDefault()
			Menu.show(event, options)
		}
		cell.title = newPath
		if (Populate.isPopulated(populatedPaths, newPath)) {
			cell.classList.add('populated')
		}

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
			var cell = rowEl.insertCell(-1),
				value = paths[path][i]
			Query.fillResultValue(cell, value, path)
			if (Populate.isPopulated(populatedPaths, path)) {
				cell.classList.add('populated')
				if (value !== undefined && !(value instanceof Populated)) {
					cell.classList.add('populated-fail')
				}
			}
		})
		rowEl.onclick = Query.selectRow
		rowEl.onmousedown = function (event) {
			// Prevent ctrl+click selection
			if (event.ctrlKey || event.shiftKey) {
				event.preventDefault()
			}
		}
	})
}

/**
 * Select the clicked row
 * @param {Event} event
 */
Query.selectRow = function (event) {
	var multi = event.shiftKey,
		add = event.ctrlKey,
		row = event.currentTarget,
		previous = Query.selection,
		start, end

	event.preventDefault()

	if (!add) {
		// Clear previous selection
		Query.selection.forEach(function (el) {
			el.classList.remove('selected')
		})

		Query.selection = []
		if (previous.length === 1 && previous[0] === row) {
			// Toggle effect
			return
		}
	}

	if (!multi || !previous.length) {
		// Select current
		row.classList.add('selected')
		Query.selection.push(row)
	} else {
		previous = previous[previous.length - 1]

		if (row.compareDocumentPosition(previous) & Node.DOCUMENT_POSITION_FOLLOWING) {
			start = row
			end = previous.nextSibling
		} else {
			start = previous
			end = row.nextSibling
		}

		do {
			start.classList.add('selected')
			Query.selection.push(start)
			start = start.nextSibling
		} while (start && start !== end)

		// Put the last clicked element at the end
		Query.selection.push(row)
	}
}

// Aux function for Query.showResult
Query.fillResultValue = function (cell, value, path) {
	var create = Panel.create,
		localDate = Boolean(Storage.get('localDate')),
		hexBinary = Boolean(Storage.get('hexBinary')),
		display = value instanceof Populated ? value.display : value

	cell.dataset.path = path
	if (display === undefined) {
		cell.innerHTML = '-'
	} else if (Array.isArray(display)) {
		cell.appendChild(create('span.json-keyword', [
			'Array[',
			create('span.json-number', display.length),
			']'
		]))
		cell.dataset.explore = true
	} else if (typeof display === 'string' && display.length > 20) {
		cell.innerHTML = json.stringify(display.substr(0, 17), true, false) + '&#133;'
		cell.dataset.collapsed = 'string'
		cell.dataset.explore = true
		cell.dataset.display = display
	} else if (display && typeof display === 'object' && display.constructor === Object) {
		cell.appendChild(create('span.json-keyword', [
			'Object{',
			create('span.json-number', Object.keys(display).length),
			'}'
		]))
		cell.dataset.collapsed = 'object'
		cell.dataset.explore = true
	} else {
		cell.innerHTML = json.stringify(display, true, false, localDate, hexBinary)
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
	var options = {},
		conn = Query.connection,
		coll = Query.collection,
		isPopulated = value instanceof Populated,
		localDate = Boolean(Storage.get('localDate')),
		hexBinary = Boolean(Storage.get('hexBinary')),
		display = isPopulated ? value.display : value

	// Explore array/object
	if (cell.dataset.explore) {
		options['Show content'] = function () {
			explore(display)
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
			Query.expandedPaths.getArray(conn, coll).pushAndSave(path)
			Query.populateResultTable()
		}
	}

	// Timestamp from object id
	if (display instanceof ObjectId) {
		options['See timestamp'] = function () {
			// Convert the first 4 bytes to Unix Timestamp then alert it
			var time = parseInt(String(display).substr(0, 8), 16),
				date = new Date(time * 1000),
				iso = date.toISOString().replace('.000', ''),
				local = String(date)

			alert('Id:\n\t' + display + '\nDatetime:\n\t' + iso + '\nLocal time:\n\t' + local)
		}

		if (path !== '_id' && !isPopulated) {
			options['Populate with'] = Query.getMenuForId(display, path, function (conn2, coll2) {
				var foreignPath = prompt('Path from ' + coll2 + ' to populate with')
				if (foreignPath !== null) {
					Populate.create(conn, coll, path, conn2, coll2, foreignPath)
					Query.populateResultTable()
				}
			})
		}
	}

	if (isPopulated) {
		options.Unpopulate = function () {
			Populate.remove(conn, coll, path)
		}
	}

	// Date display format
	if (display instanceof Date) {
		options[localDate ? 'Show UTC date' : 'Show local date'] = function () {
			Storage.set('localDate', !localDate)
			Query.populateResultTable()
		}
	}
	
	// Binary display format
	if (display instanceof BinData) {
		options[hexBinary ? 'Show in base64' : 'Show in hex'] = function () {
			Storage.set('hexBinary', !hexBinary)
			Query.populateResultTable()
		}
	}

	// Add custom buttons
	Query.modes.forEach(function (mode) {
		mode.processGlobalCellMenu && mode.processGlobalCellMenu(value, path, cell, options)
	})
	Query.mode.processCellMenu && Query.mode.processCellMenu(value, path, cell, options)

	// Show it
	event.preventDefault()
	Menu.show(event, options)
}

/**
 * Construct the a context menu
 * @param {ObjectId} value
 * @param {string} path
 * @param {function(string, string)} fn - the click function(connection, collection)
 * @returns {Object<Function>}
 */
Query.getMenuForId = function (value, path, fn) {
	var options = {},
		pathParts = path.split('.')

	Object.keys(Query.collections).forEach(function (conn) {
		Query.collections[conn].forEach(function (coll) {
			// For each collection, test if match with the path
			var match = pathParts.some(function (part) {
					if (part.substr(-2) === 'Id' || part.substr(-2) === 'ID') {
						part = part.substr(0, part.length - 2)
					}
					return coll.toLowerCase().indexOf(part.toLowerCase()) !== -1
				}),
				fn2 = fn.bind(fn, conn, coll),
				conn2

			if (match) {
				if (conn === Query.connection) {
					options[Panel.formatDocPath(coll)] = fn2
				} else {
					// Submenu for other connection
					// appending empty space is a hack to avoid name colission
					conn2 = Panel.formatDocPath(conn) + '\u200b'
					options[conn2] = options[conn2] || {}
					options[conn2][Panel.formatDocPath(coll)] = fn2
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
	var parts = [Query.mode.name, Query.connection, Query.collection].concat(Query.mode.toSearchParts())

	return '?' + parts.map(encodeURIComponent).join('&')
}

/**
 * Do a find operation based on a search URL component (generated by Query.toSearch)
 */
Query.executeFromSearch = function () {
	var search = window.location.search,
		i
	if (search[0] !== '?') {
		return
	}

	var parts = search.substr(1).split('&').map(decodeURIComponent),
		mode = parts[0],
		connection = parts[1],
		collection = parts[2]

	for (i = 0; i < Query.modes.length; i++) {
		if (Query.modes[i].name === mode) {
			Query.setMode(Query.modes[i])
			break
		}
	}
	Query.setCollection(connection, collection)
	Query.mode.executeFromSearchParts.apply(Query.mode, parts.slice(3))
}

window.addEventListener('popstate', function () {
	Query.executeFromSearch()
})