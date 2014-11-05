/*globals Query, Panel*/
'use strict'

var Distinct = {}

Distinct.name = 'distinct'

Query.registerMode(Distinct)

/**
 * Called when a query is submited
 */
Distinct.execute = function () {
	var field = Panel.value('distinct-field'),
		selector = Panel.processJSInEl('distinct-selector', false, true) || {}

	Query.setLoading(true)
	Panel.request('distinct', {
		connection: Query.connection,
		collection: Query.collection,
		field: field,
		selector: selector
	}, function (result) {
		Query.setLoading(false)
		if (!result.error) {
			Query.showResult(result.docs.map(function (doc) {
				var ret = {}
				ret[field] = doc
				return ret
			}))
		}
	})
}

/**
 * Run a distinct query
 * @param {string} field
 * @param {string} selector
 */
Distinct.run = function (field, selector) {
	Query.setMode(Distinct)
	Panel.value('distinct-field', field)
	Panel.value('distinct-selector', selector)
	Query.onFormSubmit()
}

/**
 * @returns {Array}
 */
Distinct.toSearchParts = function () {
	return [Panel.value('distinct-field'), Panel.value('distinct-selector')]
}

/**
 * Called when parsing a search URL component
 * @param {string} field
 * @param {string} selector
 */
Distinct.executeFromSearchParts = function (field, selector) {
	Panel.value('distinct-field', field)
	Panel.value('distinct-selector', selector)
	Query.onFormSubmit(null, true)
}