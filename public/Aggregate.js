/*globals Query, Panel*/
'use strict'

var Aggregate = {}

Aggregate.name = 'aggregate'

Query.registerMode(Aggregate)

/**
 * Valid operations
 * A map from operation name to operator type (object, uint or field)
 * @property {Object<string>}
 */
Aggregate.operators = {
	$geoNear: 'object',
	$group: 'object',
	$limit: 'uint',
	$match: 'object',
	$project: 'object',
	$redact: 'object',
	$skip: 'uint',
	$sort: 'object',
	$unwind: 'field'
}

/**
 * @typedef {Object} Stage
 * @property {HTMLElement} el
 * @property {HTMLElement} opEl
 * @property {HTMLElement} valueEl
 * @property {HTMLElement} preEl
 * @property {HTMLElement} posEl
 * @property {HTMLElement} addEl
 * @property {HTMLElement} deleteEl
 */

/**
 * @property {Array<Stage>}
 */
Aggregate.stages = []

/**
 * Add a new stage at the given position
 * @param {number} [pos=-1] - default: at the end (0=first)
 * @returns {Stage}
 */
Aggregate.addStage = function (pos) {
	var stage = {}

	// Create stage
	stage.el = Panel.create('span', [
		'\t{',
		stage.opEl = Panel.create('select'),
		': ',
		stage.preEl = Panel.create('span', '{'),
		stage.valueEl = Panel.create('input[size=40]'),
		stage.posEl = Panel.create('span', '}'),
		'}, ',
		stage.addEl = Panel.create('span.add'),
		' ',
		stage.deleteEl = Panel.create('span.delete'),
		Panel.create('br')
	])

	Panel.populateSelectWithArray(stage.opEl, Object.keys(Aggregate.operators).sort())
	stage.opEl.onchange = Aggregate.updateLayout
	stage.addEl.onclick = function () {
		Aggregate.addStage(Aggregate.stages.indexOf(stage) + 1)
	}
	stage.deleteEl.onclick = function () {
		Aggregate.deleteStage(stage)
	}

	if (pos === -1 || pos === undefined || pos === Aggregate.stages.length) {
		Panel.get('aggregate-stages').appendChild(stage.el)
		Aggregate.stages.push(stage)
	} else {
		Panel.get('aggregate-stages').insertBefore(stage.el, Aggregate.stages[pos].el)
		Aggregate.stages.splice(pos, 0, stage)
	}

	return stage
}

/**
 * @param {Stage} stage
 */
Aggregate.deleteStage = function (stage) {
	var pos = Aggregate.stages.indexOf(stage)
	if (pos === -1) {
		return
	}
	Aggregate.stages.splice(pos, 1)
	stage.el.parentElement.removeChild(stage.el)
}

/**
 * Update basic stage layouts
 */
Aggregate.updateLayout = function () {
	Aggregate.stages.forEach(function (stage) {
		var type = Aggregate.operators[stage.opEl.value]
		stage.preEl.textContent = type === 'object' ? '{' : (type === 'field' ? '\'$' : '')
		stage.posEl.textContent = type === 'object' ? '}' : (type === 'field' ? '\'' : '')
		stage.valueEl.size = type === 'object' ? 40 : 20
	})
}

/**
 * Called after the page is loaded
 */
Aggregate.init = function () {
	Aggregate.addStage()
	Aggregate.addStage()
	Aggregate.addStage()

	Panel.get('aggregate-add').onclick = function () {
		Aggregate.addStage(0)
	}
}

/**
 * Called when a query is submited
 */
Aggregate.execute = function () {
	var stages = Aggregate.stages.map(function (stage) {
		var type = Aggregate.operators[stage.opEl.value],
			value = stage.valueEl.value

		if (!value) {
			return
		} else if (type === 'object') {
			value = Panel.processJSInEl(stage.valueEl, false, true)
		} else if (type === 'uint') {
			value = Number(value)
		} else if (type === 'field') {
			value = '$' + value
		}

		return {
			operator: stage.opEl.value,
			operand: value
		}
	}).filter(Boolean)

	Query.setLoading(true)

	Panel.request('aggregate', {
		connection: Query.connection,
		collection: Query.collection,
		stages: stages
	}, function (result) {
		Query.setLoading(false)
		if (!result.error) {
			Query.showResult(result.docs)
		}
	})
}

/**
 * @returns {Array}
 */
Aggregate.toSearchParts = function () {
	var parts = []
	Aggregate.stages.forEach(function (stage) {
		if (stage.valueEl.value) {
			parts.push(stage.opEl.value)
			parts.push(stage.valueEl.value)
		}
	})
	return parts
}

/**
 * Called when parsing a search URL component
 * @param {...string} values
 */
Aggregate.executeFromSearchParts = function () {
	var i, stage

	// Remove all stages
	while (Aggregate.stages.length) {
		Aggregate.deleteStage(Aggregate.stages[0])
	}

	for (i = 0; i < arguments.length; i += 2) {
		stage = Aggregate.addStage()
		stage.opEl.value = arguments[i]
		stage.valueEl.value = arguments[i + 1]
	}

	Aggregate.updateLayout()
	Query.onFormSubmit(null, true)
}