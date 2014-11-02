/**
 * @file Manage simple queries
 */
/*globals Panel, ObjectId, Query, json*/
'use strict'

var Simple = {}

Simple.name = 'simple'

Simple.default = true

Simple.docsByPage = 50

Query.registerMode(Simple)

/**
 * Called after the page is loaded
 */
Simple.init = function () {
	Panel.get('simple-selector').oninput = function () {
		Panel.get('simple-find').textContent = Simple.readId(this.value) ? 'findById' : 'find'
	}
}

/**
 * Try to read an object id from the string
 * Valid examples: 53f0175172b3dd4af22d1972, "53f0175172b3dd4af22d1972", '53f0175172b3dd4af22d1972'
 * @param {string} str
 * @returns {?ObjectId} null if not valid syntax
 */
Simple.readId = function (str) {
	var match = str.match(/^(["']?)([0-9a-f]{24})\1$/)
	return match ? new ObjectId(match[2]) : null
}

/**
 * Called when active collection is changed
 */
Simple.onChangeCollection = function () {
	Panel.get('simple-sort').value = '_id: -1'
	Panel.get('simple-selector').value = ''
}

/**
 * Called when a query is submited
 */
Simple.execute = function () {
	var oid = Simple.readId(Panel.get('simple-selector').value),
		selector = (oid ? oid : Panel.processJSInEl('simple-selector', false, true)) || {},
		sort = Panel.processJSInEl('simple-sort', false, true) || {}

	Panel.get('simple-find').textContent = oid ? 'findById' : 'find'
	Simple.find(Query.connection, Query.collection, selector, sort, 0)
}

/**
 * @param {string} connection
 * @param {string} collection
 * @param {Object} selector
 * @param {Object} sort
 * @param {number} page
 */
Simple.find = function (connection, collection, selector, sort, page) {
	Query.setLoading(true)

	Panel.request('find', {
		connection: connection,
		collection: collection,
		selector: selector,
		limit: Simple.docsByPage,
		skip: Simple.docsByPage * page,
		sort: sort
	}, function (result) {
		var hasMore
		Query.setLoading(false)
		if (!result.error) {
			hasMore = result.docs.length !== Simple.docsByPage
			Query.showResult(result.docs, page, hasMore, function (page) {
				Simple.find(connection, collection, selector, sort, page)
			})
		}
	})
}

/**
 * Change the sort parameter and resend the form
 * @param {string} path
 * @param {number} direction - 1 or -1
 */
Simple.sortByPath = function (path, direction) {
	var sort
	if (path.match(/^[a-z_][a-z0-9_]*$/i)) {
		sort = path + ': ' + direction
	} else {
		sort = '\'' + path.replace(/'/g, '\\\'') + '\': ' + direction
	}
	Panel.get('simple-sort').value = sort
	Query.onFormSubmit()
}

/**
 * Run a find by id query in the main form
 * @param {string} connection
 * @param {string} collection
 * @param {ObjectId} id
 */
Simple.findById = function (connection, collection, id) {
	Query.setCollection(connection, collection)
	Panel.get('simple-selector').value = id
	Panel.get('simple-sort').value = '_id: -1'
	Query.onFormSubmit()
}


/**
 * Find all docs that have the given value for the given path
 * @param {string} path
 * @param {*} value
 * @param {string} [op='$eq'] - one of '$eq', '$ne', '$gt', '$lt', '$gte', '$lte'
 */
Simple.findByPath = function (path, value, op) {
	var query
	value = value === undefined ? null : value
	if (!/^[a-z_][a-z0-9_$]*$/.test(path)) {
		path = '\'' + path.replace(/'/g, '\\\'') + '\''
	}
	if (!op || op === '$eq') {
		query = json.stringify(value, false, false)
	} else {
		query = '{' + op + ': ' + json.stringify(value, false, false) + '}'
	}
	Panel.get('simple-selector').value = path + ': ' + query
	Query.onFormSubmit()
}

/**
 * Add custom options to cell context menu
 * @param {*} value
 * @param {string} path
 * @param {HTMLElement} cell
 * @param {Object} options
 * @returns {Object}
 */
Simple.processCellMenu = function (value, path, cell, options) {
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
		options['Find by id in'] = Simple.getMenuForId(value, path)
	} else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) {
		// Pseudo-id (stored as string)
		options['Find by id in'] = Simple.getMenuForId(new ObjectId(value), path)
	}

	return options
}

/**
 * Add custom options to column header context menu
 * @param {string} path
 * @param {Object} options
 * @returns {Object}
 */
Simple.processHeadMenu = function (path, options) {
	options['Sort asc'] = Simple.sortByPath.bind(Simple, path, 1)
	options['Sort desc'] = Simple.sortByPath.bind(Simple, path, -1)
	return options
}

/**
 * Construct the find-by-id context menu
 * @param {ObjectId} value
 * @param {string} path
 * @returns {Object<Function>}
 */
Simple.getMenuForId = function (value, path) {
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
 * @returns {Array}
 */
Simple.toSearchParts = function () {
	return [Panel.get('simple-selector').value, Panel.get('simple-sort').value]
}

/**
 * Called when parsing a search URL component
 * @param {string} selector
 * @param {string} sort
 */
Simple.executeFromSearchParts = function (selector, sort) {
	Panel.get('simple-selector').value = selector
	Panel.get('simple-sort').value = sort
	Query.onFormSubmit(null, true)
}