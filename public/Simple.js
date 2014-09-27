/**
 * @file Manage simple queries
 */
/*globals Panel, ObjectId, Query, json*/
'use strict'

var Simple = {}

Simple.docsByPage = 50

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
	Panel.get('simple-sort').value = '{_id: -1}'
	Panel.get('simple-selector').value = '{}'
}

/**
 * Called when a query is submited
 */
Simple.execute = function () {
	var oid = Simple.readId(Panel.get('simple-selector').value),
		selector = (oid ? oid : Panel.processJSInEl('simple-selector')) || {},
		sort = Panel.processJSInEl('simple-sort') || {}

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
		sort = '{' + path + ': ' + direction + '}'
	} else {
		sort = '{\'' + path.replace(/'/g, '\\\'') + '\': ' + direction + '}'
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
	Panel.get('simple-sort').value = '{_id: -1}'
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
	if (!/^[a-z_][a-z0-9_$]*$/.test(path)) {
		path = '\'' + path.replace(/'/g, '\\\'') + '\''
	}
	if (!op || op === '$eq') {
		query = json.stringify(value, false, false)
	} else {
		query = '{' + op + ': ' + json.stringify(value, false, false) + '}'
	}
	Panel.get('simple-selector').value = '{' + path + ': ' + query + '}'
	Query.onFormSubmit()
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