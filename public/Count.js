/*globals Query, Panel, Input*/
'use strict'

var Count = {}

Count.name = 'count'

Count.selectorInput = null

Query.registerMode(Count)

/**
 * Called after the page is loaded
 */
Count.init = function () {
	Count.selectorInput = new Input('count-selector')
}

/**
 * Called when a query is submited
 */
Count.execute = function () {
	var selector = Panel.processJSInEl(Count.selectorInput, false, true) || {}

	Query.setLoading(true)
	Panel.request('count', {
		connection: Query.connection,
		collection: Query.collection,
		selector: selector
	}, function (result) {
		Query.setLoading(false)
		if (!result.error) {
			Query.showResult([{
				count: result.count
			}])
		}
	})
}

/**
 * Run a distinct query
 * @param {string} field
 * @param {string} selector
 */
Count.run = function (selector) {
	Query.setMode(Count)
	Count.selectorInput.value = selector
	Query.onFormSubmit()
}

/**
 * @returns {Array}
 */
Count.toSearchParts = function () {
	return [Count.selectorInput.value]
}

/**
 * Called when parsing a search URL component
 * @param {string} selector
 */
Count.executeFromSearchParts = function (selector) {
	Count.selectorInput.value = selector
	Query.onFormSubmit(null, true)
}

/**
 * Called when coping as MongoDB Shell query
 * @param {string} prefix
 */
Count.toString = function (prefix) {
	let selector = Count.selectorInput,
		query = prefix + '.count('

	if (selector) {
		query += '{' + selector + '}'
	}
	query += ')'

	return query
}