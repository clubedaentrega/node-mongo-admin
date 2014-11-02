/*globals Query, Panel*/
'use strict'

var Distinct = {}

Distinct.name = 'distinct'

Query.registerMode(Distinct)

/**
 * Called when a query is submited
 */
Distinct.execute = function () {
	var field = Panel.get('distinct-field').value,
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
 * @returns {Array}
 */
Distinct.toSearchParts = function () {
	return [Panel.get('distinct-field').value, Panel.get('distinct-selector').value]
}

/**
 * Called when parsing a search URL component
 * @param {string} field
 * @param {string} selector
 */
Distinct.executeFromSearchParts = function (field, selector) {
	Panel.get('distinct-field').value = field
	Panel.get('distinct-selector').value = selector
	Query.onFormSubmit(null, true)
}