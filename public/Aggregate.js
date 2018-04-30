/* globals Query, Panel, Select, Input*/
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
		getValue(input) {
			return Panel.processJSInEl(input, false, true)
		}
	},
	uint: {
		getValue(input) {
			return Number(input.value)
		}
	},
	field: {
		prefix: '\'$',
		posfix: '\'',
		getValue(input) {
			return '$' + input.value
		}
	},
	optionalObject: {
		prefix: '{',
		posfix: '}',
		mayBeEmpty: true,
		getValue(input) {
			return Aggregate.operatorTypes.object.getValue(input) || {}
		}
	},
	string: {
		prefix: '\'',
		posfix: '\'',
		getValue(input) {
			return input.value
		}
	},
	expression: {
		prefix: '',
		posfix: '',
		getValue(input) {
			return Panel.processJSInEl(input, false, false)
		}
	}
}

/**
 * Valid operations
 * A map from operation name to operator type and default placeholder
 * @property {Object<Array<string>>}
 */
Aggregate.operators = {
	addFields: ['object', '_newField_: _expression_, _etc_'],
	bucket: ['object', 'groupBy: _expression_, boundaries: [_lowerBound_, _etc_], default: _literal_, output: {_field_: {_accumulator_: _expression_}, _etc_}'],
	bucketAuto: ['object', 'groupBy: _expression_, buckets: _number_, output: {_field_: {_accumulator_: _expression_}, _etc_}, granularity: _string_'],
	collStats: ['object', 'latencyStats: {histograms: _boolean_}, storageStats: {}, count: {}'],
	count: ['string', '_outputField_'],
	currOp: ['object', 'allUsers: _boolean_, idleConnections: _boolean_'],
	facet: ['object', '_outputField_: [_stage_, _etc_], _etc_'],
	geoNear: ['object', '_options_'],
	graphLookup: ['object', 'from: _collection_, startWith: _expression_, connectFromField: _string_, connectToField: _string_, as: _string_, maxDepth: _number_, depthField: _string_, restrictSearchWithMatch: _document_'],
	group: ['object', '_id: _expression_, _field_: {_accumulator_: _expression_}, _etc_'],
	indexStats: ['optionalObject', ''],
	limit: ['uint', ''],
	listLocalSessions: ['optionalObject', ''],
	listSessions: ['optionalObject', ''],
	lookup: ['object', 'from: _collection_, localField: _string_, foreignField: _string_, as: _string_'],
	'lookup (join)': ['object', 'from: _collection_, let: {_var_: _expression_, _etc_}, pipeline: [_stage_, _etc_], as: _string_'],
	match: ['object', '_query_'],
	project: ['object', '_specification(s)_'],
	redact: ['object', '_expression_'],
	replaceRoot: ['object', 'newRoot: _replacementDocument_'],
	sample: ['object', 'size: _number_'],
	skip: ['uint', ''],
	sort: ['object', '_field_: _order_, _etc_'],
	sortByCount: ['expression', '_expression_'],
	unwind: ['field', ''],
	'unwind (object)': ['object', 'path: _path_, includeArrayIndex: _string_, preserveNullAndEmptyArrays: _boolean_']
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
 * @property {string} oldPlaceholder
 */

/**
 * @property {Array<Stage>}
 */
Aggregate.stages = []

/**
 * Add a new stage at the given position
 * @param {number} [pos=-1] - default: at the end (0=first)
 * @param {string} [operator]
 * @param {string} [value]
 * @returns {Stage}
 */
Aggregate.addStage = function (pos, operator, value) {
	let stage = {}

	// Create stage
	stage.opSelect = new Select(Panel.create('span'))
	stage.valueInput = new Input(Panel.create('span'))
	stage.oldPlaceholder = ''
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

	if (operator) {
		stage.opSelect.value = operator
		if (value !== undefined) {
			stage.valueInput.value = value
		}
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
	Aggregate.stages.forEach(stage => {
		let rule = Aggregate.operators[stage.opSelect.value],
			type = Aggregate.operatorTypes[rule[0]],
			value = stage.valueInput.value
		stage.preEl.textContent = type.prefix || ''
		stage.posEl.textContent = type.posfix || ''
		if (value === stage.oldPlaceholder || (!value && !type.mayBeEmpty)) {
			stage.valueInput.value = rule[1]
		}
		stage.oldPlaceholder = rule[1]
	})
}

/**
 * Called after the page is loaded
 */
Aggregate.init = function () {
	Aggregate.addStage(-1, 'match')
	Aggregate.addStage(-1, 'project')
	Aggregate.addStage(-1, 'sort', '_id: -1')
	Aggregate.addStage(-1, 'limit', '50')

	Panel.get('aggregate-add').onclick = function () {
		Aggregate.addStage(0)
	}
}

/**
 * Called when a query is submited
 */
Aggregate.execute = function () {
	let stages = Aggregate.getStages().map(stage => {
		let op = stage.opSelect.value,
			rule = Aggregate.operators[op],
			type = Aggregate.operatorTypes[rule[0]],
			value = stage.valueInput.value

		value = type.getValue(stage.valueInput)

		return {
			operator: '$' + Aggregate.toOperatorName(op),
			operand: value
		}
	})

	Query.setLoading(loaded => {
		Panel.request('aggregate', {
			connection: Query.connection,
			collection: Query.collection,
			stages
		}, result => {
			if (loaded() && !result.error) {
				Query.showResult(result.docs)
			}
		})
	})
}

/**
 * @returns {Array}
 */
Aggregate.toSearchParts = function () {
	let parts = []
	Aggregate.getStages().forEach(stage => {
		parts.push(stage.opSelect.value)
		parts.push(stage.valueInput.value)
	})
	return parts
}

/**
 * Called when parsing a search URL component
 * @param {...string} values
 */
Aggregate.executeFromSearchParts = function (...args) {
	// Remove all stages
	while (Aggregate.stages.length) {
		Aggregate.deleteStage(Aggregate.stages[0])
	}

	for (let i = 0; i < args.length; i += 2) {
		let stage = Aggregate.addStage(-1, args[i], args[i + 1])
		stage.opSelect.value = args[i]
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

	for (let stage of Aggregate.getStages()) {
		let op = stage.opSelect.value,
			type = Aggregate.operatorTypes[Aggregate.operators[op][0]],
			value = stage.valueInput.value,
			pre = type.prefix || '',
			pos = type.posfix || ''

		if (first) {
			first = false
		} else {
			query += ', '
		}
		query += `{$${Aggregate.toOperatorName(op)}: ${pre}${value}${pos}}`
	}

	query += '])'

	return query
}

/**
 * Remove everything after the first space:
 * 'x' -> 'x', 'x (y)' -> 'x'
 * @param {string} value
 * @returns {string}
 */
Aggregate.toOperatorName = function (string) {
	return string.replace(/ .*/, '')
}

/**
 * Return active stages
 * @returns {Array<Stage>}
 */
Aggregate.getStages = function () {
	return Aggregate.stages.filter(Aggregate.isStageActive)
}

/**
 * @param {Stage} stage
 * @returns {boolean}
 */
Aggregate.isStageActive = function (stage) {
	let op = stage.opSelect.value,
		rule = Aggregate.operators[op],
		type = Aggregate.operatorTypes[rule[0]],
		value = stage.valueInput.value

	if (!value) {
		return type.mayBeEmpty
	} else if (value === rule[1]) {
		return false
	}
	return true
}