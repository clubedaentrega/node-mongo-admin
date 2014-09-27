/*globals Query*/
'use strict'

var Aggregate = {}

Aggregate.name = 'aggregate'

Query.registerMode(Aggregate)

/**
 * Called after the page is loaded
 */
Aggregate.init = function () {}

/**
 * Called when a query is submited
 */
Aggregate.execute = function () {}

/**
 * @returns {Array}
 */
Aggregate.toSearchParts = function () {
	return []
}

/**
 * Called when parsing a search URL component
 */
Aggregate.executeFromSearchParts = function () {}