/*globals Query, Panel, Select, Input*/
'use strict'

let Aggregate = {}

Aggregate.name = 'aggregate'

Query.registerMode(Aggregate)

/**
 * Valid operation types
 * @property {Object<Object>}
 */
Aggregate.operatorTypes = {
	object: {
		prefix: '{',
		posfix: '}',
		getValue: function (input) {
			return Panel.processJSInEl(input, false, true)
		}
	},
	uint: {
		getValue: function (input) {
			return Number(input.value)
		}
	},
	field: {
		prefix: '\'$',
		posfix: '\'',
		getValue: function (input) {
			return '$' + input.value
		}
	},
	sample: {
		prefix: '{size: ',
		posfix: '}',
		getValue: function (input) {
			return {
				size: Number(input.value)
			}
		}
	},
	indexStats: {
		prefix: '{',
		posfix: '}',
		mayBeEmpty: true,
		getValue: function (input) {
			return Aggregate.operatorTypes.object.getValue(input) || {}
		}
	}
}

/**
 * Valid operations
 * A map from operation name to operator type
 * @property {Object<string>}
 */
Aggregate.operators = {
	geoNear: 'object',
	group: 'object',
	limit: 'uint',
	match: 'object',
	project: 'object',
	redact: 'object',
	skip: 'uint',
	sort: 'object',
	unwind: 'field',
	'unwind (object)': 'object',
	sample: 'sample',
	indexStats: 'indexStats',
	lookup: 'object'
}

/**
 * @typedef {Object} Stage
 * @property {HTMLElement} el
 * @property {Select} opSelect
 * @property {HTMLElement} valueInput
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
	let stage = {}

	// Create stage
	stage.opSelect = new Select(Panel.create('span'))
	stage.valueInput = new Input(Panel.create('span'))
	stage.el = Panel.create('span', [
		'\t{$',
		stage.opSelect.el,
		': ',
		stage.preEl = Panel.create('span'),
		stage.valueInput.el,
		stage.posEl = Panel.create('span'),
		'}, ',
		stage.addEl = Panel.create('span.add'),
		' ',
		stage.deleteEl = Panel.create('span.delete'),
		Panel.create('br')
	])

	stage.opSelect.setOptions(Object.keys(Aggregate.operators).sort())
	stage.opSelect.onchange = Aggregate.updateLayout
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

	Aggregate.updateLayout()

	return stage
}

/**
 * @param {Stage} stage
 */
Aggregate.deleteStage = function (stage) {
	let pos = Aggregate.stages.indexOf(stage)
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
		let type = Aggregate.operatorTypes[Aggregate.operators[stage.opSelect.value]]
		stage.preEl.textContent = type.prefix || ''
		stage.posEl.textContent = type.posfix || ''
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
	let stages = Aggregate.stages.map(function (stage) {
		let op = stage.opSelect.value,
			type = Aggregate.operatorTypes[Aggregate.operators[op]],
			value = stage.valueInput.value

		if (!value && !type.mayBeEmpty) {
			return
		}
		value = type.getValue(stage.valueInput)

		return {
			operator: '$' + (op === 'unwind (object)' ? 'unwind' : op),
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
	let parts = []
	Aggregate.stages.forEach(function (stage) {
		let type = Aggregate.operatorTypes[Aggregate.operators[stage.opSelect.value]],
			value = stage.valueInput.value
		if (value || type.mayBeEmpty) {
			parts.push(stage.opSelect.value)
			parts.push(stage.valueInput.value)
		}
	})
	return parts
}

/**
 * Called when parsing a search URL component
 * @param {...string} values
 */
Aggregate.executeFromSearchParts = function () {
	let i, stage

	// Remove all stages
	while (Aggregate.stages.length) {
		Aggregate.deleteStage(Aggregate.stages[0])
	}

	for (i = 0; i < arguments.length; i += 2) {
		stage = Aggregate.addStage()
		stage.opSelect.value = arguments[i]
		stage.valueInput.value = arguments[i + 1]
	}

	Aggregate.updateLayout()
	Query.onFormSubmit(null, true)
}

/**
 * Called when coping as MongoDB Shell query
 * @param {string} prefix
 */
Aggregate.toString = function (prefix) {
	let query = prefix + '.aggregate([',
		first = true

	for (let stage of Aggregate.stages) {
		let op = stage.opSelect.value,
			type = Aggregate.operatorTypes[Aggregate.operators[op]],
			value = stage.valueInput.value,
			pre = type.prefix || '',
			pos = type.posfix || ''

		if (!value && !type.mayBeEmpty) {
			continue
		}

		if (first) {
			first = false
		} else {
			query += ', '
		}
		query += `{$${op === 'unwind (object)' ? 'unwind' : op}: ${pre}${value}${pos}}`
	}

	query += '])'

	return query
}