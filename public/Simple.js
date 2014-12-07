/**
 * @file Manage simple queries
 */
/*globals Panel, ObjectId, Query, json, explore, Distinct*/
'use strict'

var Simple = {}

Simple.name = 'simple'

Simple.default = true

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
	Panel.value('simple-sort', '_id: -1')
	Panel.value('simple-selector', '')
}

/**
 * Called when a query is submited
 */
Simple.execute = function () {
	var oid = Simple.readId(Panel.value('simple-selector')),
		selector = (oid ? oid : Panel.processJSInEl('simple-selector', false, true)) || {},
		sort = Panel.processJSInEl('simple-sort', false, true) || {},
		limit = Number(Panel.value('simple-limit'))

	Panel.get('simple-find').textContent = oid ? 'findById' : 'find'
	Simple.find(Query.connection, Query.collection, selector, sort, limit, 0)
}

/**
 * @param {string} connection
 * @param {string} collection
 * @param {Object} selector
 * @param {Object} sort
 * @param {number} page
 */
Simple.find = function (connection, collection, selector, sort, limit, page) {
	Query.setLoading(true)

	Panel.request('find', {
		connection: connection,
		collection: collection,
		selector: selector,
		limit: limit,
		skip: limit * page,
		sort: sort
	}, function (result) {
		var hasMore
		Query.setLoading(false)
		if (!result.error) {
			hasMore = result.docs.length === limit
			Query.showResult(result.docs, page, hasMore, function (page) {
				Simple.find(connection, collection, selector, sort, limit, page)
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
	Panel.value('simple-sort', sort)
	Query.onFormSubmit()
}

/**
 * Run a find by id query in the main form (may be called by other modes)
 * @param {string} connection
 * @param {string} collection
 * @param {ObjectId} id
 */
Simple.findById = function (connection, collection, id) {
	Query.setCollection(connection, collection)
	Query.setMode(Simple)
	Panel.value('simple-selector', id)
	Panel.value('simple-sort', '_id: -1')
	Query.onFormSubmit()
}

/**
 * Run a find by id query and show the result in the explore window
 * @param {string} connection
 * @param {string} collection
 * @param {ObjectId} id
 */
Simple.exploreById = function (connection, collection, id) {
	explore('Loading...')
	Panel.request('find', {
		connection: connection,
		collection: collection,
		selector: {
			_id: id
		},
		limit: 1,
		skip: 0,
		sort: {}
	}, function (result) {
		explore(result.docs[0])
	})
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
	Panel.value('simple-selector', path + ': ' + query)
	Query.onFormSubmit()
}

/**
 * Add custom options to cell context menu in any mode
 * @param {*} value
 * @param {string} path
 * @param {HTMLElement} cell
 * @param {Object} options
 */
Simple.processGlobalCellMenu = function (value, path, cell, options) {
	// Find by id
	if (value instanceof ObjectId && path !== '_id') {
		// Let user search for this id in another collection with a related name
		addIdMenu(value)
	} else if (typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)) {
		// Pseudo-id (stored as string)
		addIdMenu(new ObjectId(value))
	}

	function addIdMenu(value) {
		options['Find by id in'] = Query.getMenuForId(value, path, function (conn, coll) {
			Simple.findById(conn, coll, value)
		})
		options['Show doc from'] = Query.getMenuForId(value, path, function (conn, coll) {
			Simple.exploreById(conn, coll, value)
		})
	}
}

/**
 * Add custom options to cell context menu
 * @param {*} value
 * @param {string} path
 * @param {HTMLElement} cell
 * @param {Object} options
 */
Simple.processCellMenu = function (value, path, cell, options) {
	// Find
	options['Find by ' + path] = {
		Equal: Simple.findByPath.bind(Simple, path, value),
		Different: Simple.findByPath.bind(Simple, path, value, '$ne'),
		Greater: Simple.findByPath.bind(Simple, path, value, '$gt'),
		Less: Simple.findByPath.bind(Simple, path, value, '$lt'),
		'Equal to': function () {
			var value = prompt(),
				el
			if (value) {
				el = document.createElement('input')
				el.value = value
				Simple.findByPath(path, Panel.processJSInEl(el))
			}
		}
	}
}

/**
 * Add custom options to column header context menu
 * @param {string} path
 * @param {Object} options
 */
Simple.processHeadMenu = function (path, options) {
	options['Sort asc'] = Simple.sortByPath.bind(Simple, path, 1)
	options['Sort desc'] = Simple.sortByPath.bind(Simple, path, -1)
	options['Show distinct'] = Distinct.run.bind(Distinct, path, Panel.value('simple-selector'))
}

/**
 * @returns {Array}
 */
Simple.toSearchParts = function () {
	return [
		Panel.value('simple-selector'),
		Panel.value('simple-sort'),
		Panel.value('simple-limit')
	]
}

/**
 * Called when parsing a search URL component
 * @param {string} selector
 * @param {string} sort
 * @param {string} limit
 */
Simple.executeFromSearchParts = function (selector, sort, limit) {
	Panel.value('simple-selector', selector)
	Panel.value('simple-sort', sort)
	Panel.value('simple-limit', limit)
	Query.onFormSubmit(null, true)
}