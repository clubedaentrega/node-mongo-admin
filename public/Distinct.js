/*globals Query, Panel, Input*/
'use strict'

var Distinct = {}

Distinct.name = 'distinct'

Distinct.fieldInput = null
Distinct.selectorInput = null

Query.registerMode(Distinct)

/**
 * Called after the page is loaded
 */
Distinct.init = function () {
	Distinct.fieldInput = new Input('distinct-field')
	Distinct.selectorInput = new Input('distinct-selector')
}

/**
 * Called when a query is submited
 */
Distinct.execute = function () {
	var field = Distinct.fieldInput.value,
		selector = Panel.processJSInEl(Distinct.selectorInput, false, true) || {}

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
	Distinct.fieldInput.value = field
	Distinct.selectorInput.value = selector
	Query.onFormSubmit()
}

/**
 * @returns {Array}
 */
Distinct.toSearchParts = function () {
	return [Distinct.fieldInput.value, Distinct.selectorInput.value]
}

/**
 * Called when parsing a search URL component
 * @param {string} field
 * @param {string} selector
 */
Distinct.executeFromSearchParts = function (field, selector) {
	Distinct.fieldInput.value = field
	Distinct.selectorInput.value = selector
	Query.onFormSubmit(null, true)
}