/*globals Panel, ObjectId, BinData, DBRef, MinKey, MaxKey, Long, json, explore, Menu*/
'use strict'

var Query = {}

Query.docsByPage = 50

/**
 * Query.collections[connectionName] is a array of collection names
 * @property {Object<Array<string>>}
 */
Query.collections = {}

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
	var connectionNames = []

	connections.forEach(function (connection) {
		Query.collections[connection.name] = connection.collections
		connectionNames.push({
			value: connection.name,
			text: Panel.formatDocPath(connection.name)
		})
	})

	Panel.populateSelectWithArray('query-connections', connectionNames)
	Panel.get('query-connections').onchange = Query.onChangeConnection
	Query.onChangeConnection()

	Panel.get('query-selector').oninput = function () {
		Panel.get('query-find').textContent = Query.readId(this.value) ? 'findById' : 'find'
	}

	Panel.get('query-collections').onchange = Query.onChangeCollection

	Panel.get('query-form').onsubmit = Query.onFormSubmit

	if (window.location.hash) {
		Query.findFromHash(window.location.hash)
	}
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
	}
}

Query.onChangeCollection = function () {
	Panel.get('query-sort').value = '{_id: -1}'
	Panel.get('query-selector').value = '{}'
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

	var oid = Query.readId(Panel.get('query-selector').value),
		selector = (oid ? oid : Panel.processJSInEl('query-selector')) || {},
		sort = Panel.processJSInEl('query-sort') || {},
		connection = Query.connection,
		collection = Panel.get('query-collections').value

	Panel.get('query-find').textContent = oid ? 'findById' : 'find'
	Query.find(connection, collection, selector, sort, 0)

	if (!dontPushState) {
		// Update page URL
		window.history.pushState(null, '', Query.toHash(connection, collection, selector, sort))
	}
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
		treeDepth = 1,
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
			explore(doc)
		}
		eye.title = 'Show raw document'
		pathNames.forEach(function (path) {
			Query._fillResultValue(rowEl.insertCell(-1), paths[path][i], path)
		})
	})
}

/**
 * Run a find by id query in the main form
 * @param {string} connection
 * @param {string} collection
 * @param {ObjectId} id
 */
Query.findById = function (connection, collection, id) {
	Query.setCollection(connection, collection)
	Panel.get('query-selector').value = id
	Panel.get('query-sort').value = '{_id: -1}'
	Query.onFormSubmit()
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
				explore(value)
			}
			cell.style.cursor = 'pointer'
			cell.title = 'Click to explore'
		}
	} else if (typeof value === 'string' && value.length > 20) {
		cell.innerHTML = json.stringify(value.substr(0, 17), true, false) + '&#133;'
		cell.onclick = function () {
			this.innerHTML = json.stringify(value, true, false)
			cell.onclick = null
		}
		cell.style.cursor = 'pointer'
		cell.title = 'Click to expand'
	} else {
		cell.innerHTML = json.stringify(value, true, false)
	}

	if (value !== undefined) {
		cell.ondblclick = function (event) {
			event.preventDefault()
			Query.findByPath(path, value)
		}
	}

	// Add context menu
	cell.oncontextmenu = Query.openMenu.bind(Query, value, path)
}

/**
 * Construct options for the context menu
 * @param {*} value
 * @param {string} path
 * @param {MouseEvent} event
 */
Query.openMenu = function (value, path, event) {
	var options = {},
		show = false

	if (value instanceof ObjectId && path !== '_id') {
		// Let user search for this id in another collection with a related name
		options['Find by id in'] = Query.getMenuForId(value, path)
		show = true
	} else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) {
		// Pseudo-id (stored as string)
		options['Find by id in'] = Query.getMenuForId(new ObjectId(value), path)
		show = true
	}

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
					Query.findById(conn, coll, value)
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
 * Try to read an object id from the string
 * Valid examples: 53f0175172b3dd4af22d1972, "53f0175172b3dd4af22d1972", '53f0175172b3dd4af22d1972'
 * @param {string} str
 * @returns {?ObjectId} null if not valid syntax
 */
Query.readId = function (str) {
	var match = str.match(/^(["']?)([0-9a-f]{24})\1$/)
	return match ? new ObjectId(match[2]) : null
}

/**
 * Convert the current query to a hash component
 * @param {string} connection
 * @param {string} collection
 * @param {Object} selector
 * @param {Object} sort
 * @param {number} page
 */
Query.toHash = function (connection, collection, selector, sort) {
	return '#' + JSON.stringify([
		connection,
		collection,
		json.stringify(selector),
		json.stringify(sort)
	])
}

/**
 * Do a find operation based on a hash (generated by Query.toHash)
 * @param {string} hash
 */
Query.findFromHash = function (hash) {
	if (hash[0] !== '#') {
		return
	}

	var parts = JSON.parse(hash.substr(1)),
		connection = parts[0],
		collection = parts[1],
		selector = parts[2],
		sort = parts[3]

	Query.setCollection(connection, collection)
	Panel.get('query-selector').value = selector
	Panel.get('query-sort').value = sort
	Query.onFormSubmit(null, true)
}

window.addEventListener('popstate', function () {
	Query.findFromHash(window.location.hash)
})