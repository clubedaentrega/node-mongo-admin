/**
 * @file Manage simple queries
 */
/* globals Panel, ObjectId, Query, json, explore, Distinct, Populated, Input*/
'use strict'

let Simple = {}

Simple.name = 'simple'

Simple.default = true

Simple.selectorInput = null
Simple.selectInput = null
Simple.sortInput = null
Simple.limitInput = null

Query.registerMode(Simple)

/**
 * Called after the page is loaded
 */
Simple.init = function () {
	Simple.selectorInput = new Input('simple-selector', true)
	Simple.selectInput = new Input('simple-select')
	Simple.sortInput = new Input('simple-sort')
	Simple.limitInput = new Input('simple-limit')
	Simple.selectorInput.oninput = function () {
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
	let match = str.match(/^(["']?)([0-9a-f]{24})\1$/)
	return match ? new ObjectId(match[2]) : null
}

/**
 * Called when active collection is changed
 */
Simple.onChangeCollection = function () {
	Simple.sortInput.value = '_id: -1'
	Simple.selectorInput.value = ''
	Simple.selectInput.value = ''
	Simple.limitInput.value = '50'
}

/**
 * Called when a query is submited
 */
Simple.execute = function () {
	let oid = Simple.readId(Simple.selectorInput.value),
		selector = (oid ? {
			_id: oid
		} : Panel.processJSInEl(Simple.selectorInput, false, true)) || {},
		select = Panel.processJSInEl(Simple.selectInput, false, true) || {},
		sort = Panel.processJSInEl(Simple.sortInput, false, true) || {},
		limit = Number(Simple.limitInput.value)

	Panel.get('simple-find').textContent = oid ? 'findById' : 'find'
	Simple.find(Query.connection, Query.collection, selector, select, sort, limit, 0, Boolean(oid))
}

/**
 * @param {string} connection
 * @param {string} collection
 * @param {Object} selector
 * @param {Object} select
 * @param {Object} sort
 * @param {number} page
 * @param {boolean} byId
 */
Simple.find = function (connection, collection, selector, select, sort, limit, page, byId) {
	Query.setLoading(loaded => {
		Panel.request('find', {
			connection,
			collection,
			selector,
			select,
			limit,
			skip: limit * page,
			sort
		}, result => {
			if (loaded() && !result.error) {
				let hasMore = result.docs.length === limit
				Query.showResult(result.docs, page, hasMore, page => {
					Simple.find(connection, collection, selector, select, sort, limit, page, byId)
				})
				if (byId && result.docs.length === 1) {
					explore(result.docs[0])
				}
			}
		})
	})
}

/**
 * Change the sort parameter and resend the form
 * @param {string} path
 * @param {number} direction - 1 or -1
 */
Simple.sortByPath = function (path, direction) {
	let sort
	if (path.match(/^[a-z_][a-z0-9_]*$/i)) {
		sort = path + ': ' + direction
	} else {
		sort = '\'' + path.replace(/'/g, '\\\'') + '\': ' + direction
	}
	Simple.sortInput.value = sort
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
	Simple.selectorInput.value = id
	Simple.selectInput.value = ''
	Simple.sortInput.value = '_id: -1'
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
		connection,
		collection,
		selector: {
			_id: id
		},
		select: {},
		limit: 1,
		skip: 0,
		sort: {}
	}, result => {
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
	let query
	value = value === undefined ? null : value
	if (!/^[a-z_][a-z0-9_$]*$/.test(path)) {
		path = '\'' + path.replace(/'/g, '\\\'') + '\''
	}
	if (!op || op === '$eq') {
		query = json.stringify(value, false, false)
	} else {
		query = '{' + op + ': ' + json.stringify(value, false, false) + '}'
	}
	Simple.selectorInput.value = path + ': ' + query
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
	let isPopulated = value instanceof Populated,
		display = isPopulated ? value.display : value,
		original

	// Find by id
	if (display instanceof ObjectId && path !== '_id') {
		// Let user search for this id in another collection with a related name
		addIdMenu(display, false)
	} else if (typeof display === 'string' && /^[0-9a-f]{24}$/.test(display)) {
		// Pseudo-id (stored as string)
		addIdMenu(new ObjectId(display), false)
	}
	if (isPopulated) {
		original = value.original
		if (original instanceof ObjectId && path !== '_id') {
			// Let user search for this id in another collection with a related name
			addIdMenu(original, true)
		} else if (typeof original === 'string' && /^[0-9a-f]{24}$/.test(original)) {
			// Pseudo-id (stored as string)
			addIdMenu(new ObjectId(original), true)
		}
	}

	function addIdMenu(value, isOriginal) {
		let labelFind = 'Find by ' + (isOriginal ? 'original ' : '') + 'id in',
			labelShow = 'Show ' + (isOriginal ? 'original ' : '') + 'doc from'
		options[labelFind] = Query.getMenuForId(value, path, (conn, coll) => {
			Simple.findById(conn, coll, value)
		})
		options[labelShow] = Query.getMenuForId(value, path, (conn, coll) => {
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
	let isPopulated = value instanceof Populated,
		display = isPopulated ? value.display : value

	if (!isPopulated) {
		// Find
		options['Find by ' + path] = {
			Equal: Simple.findByPath.bind(Simple, path, display),
			Different: Simple.findByPath.bind(Simple, path, display, '$ne'),
			Greater: Simple.findByPath.bind(Simple, path, display, '$gt'),
			Less: Simple.findByPath.bind(Simple, path, display, '$lt'),
			'Equal to' () {
				let value = prompt(),
					el
				if (value) {
					el = document.createElement('input')
					el.value = value
					Simple.findByPath(path, Panel.processJSInEl(el))
				}
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
	options['Show distinct'] = Distinct.run.bind(Distinct, path, Simple.selectorInput.value)
}

/**
 * @returns {Array}
 */
Simple.toSearchParts = function () {
	return [
		Simple.selectorInput.value,
		Simple.sortInput.value,
		Simple.limitInput.value,
		Simple.selectInput.value
	]
}

/**
 * Called when parsing a search URL component
 * @param {string} selector
 * @param {string} sort
 * @param {string} limit
 * @param {?string} select
 */
Simple.executeFromSearchParts = function (selector, sort, limit, select) {
	Simple.selectorInput.value = selector
	Simple.sortInput.value = sort
	Simple.limitInput.value = limit
	Simple.selectInput.value = select || ''
	Query.onFormSubmit(null, true)
}

/**
 * Called when coping as MongoDB Shell query
 * @param {string} prefix
 */
Simple.toString = function (prefix) {
	let selector = Simple.selectorInput.value,
		select = Simple.selectInput.value,
		sort = Simple.sortInput.value,
		limit = Simple.limitInput.value,
		oid = Simple.readId(selector),
		query = prefix

	if (oid) {
		query += '.findOne({_id: ObjectId(\'' + oid.$oid + '\')}'
	} else {
		query += '.find({' + selector + '}'
	}

	if (select) {
		query += ', {' + select + '}'
	}
	query += ')'

	if (!oid) {
		if (sort) {
			query += '.sort({' + sort + '})'
		}
		if (limit) {
			query += '.limit(' + limit + ')'
		}
	}

	return query
}