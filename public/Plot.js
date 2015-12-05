/*globals Panel, Input, google, Query*/
'use strict'

var Plot = {}

/**
 * @typedef {Object} Plot~Series
 * @property {HTMLElement} el
 * @property {Plot.DataSelector} dataSelector
 * @property {HTMLElement} addEl
 * @property {HTMLElement} deleteEl
 */

/**
 * Bind DOM events
 */
Plot.init = function () {
	Panel.get('plot').onclick = Plot.start
	Panel.get('plot-clear').onclick = Plot.stop
	Panel.get('plot-type').onchange = function () {
		Panel.get('plot-stacked').style.display = Panel.value('plot-type') === 'line' ? 'none' : ''
		Plot.update()
	}
	Panel.get('plot-stacked').onchange = Plot.update
	Plot.titleInput = new Input('plot-title')
	Plot.titleInput.oninput = Plot.update
	Plot.xAxis = new Plot.DataSelector('plot-x-axis')
	Plot.xAxis.onchange = Plot.update
	Plot.series = []
	Panel.get('plot-add-series').onclick = function () {
		Plot.addSeries(0)
	}
	Plot.addSeries()

	// Load google charts
	google.charts.load('current', {
		packages: ['corechart']
	})
	google.charts.setOnLoadCallback(function () {
		Plot.ready = true
	})
}

window.addEventListener('load', Plot.init)

/**
 * Whether google charts has loaded
 * @property {boolean}
 */
Plot.ready = false

/**
 * @class
 * @param {string|HTMLElement} el
 */
Plot.DataSelector = function (el) {
	var that = this

	this.el = Panel.get(el)

	/**
	 * Called when some data has changed
	 * @member {function()}
	 */
	this.onchange = null

	// Construct internal DOM (a button and a text input)
	this._fieldButton = Panel.create('button', 'Select field')
	this._nameInput = new Input(Panel.create('span'))
	this.el.appendChild(this._fieldButton)
	this.el.appendChild(Panel.create('span', ', name: '))
	this.el.appendChild(this._nameInput.el)

	this._fieldButton.onclick = this.selectField.bind(this)
	this._nameInput.oninput = function () {
		if (that.onchange) {
			that.onchange()
		}
	}
}

/**
 * Ask the user to select one field
 */
Plot.DataSelector.prototype.selectField = function (originalEvent) {
	var targets = Panel.getAll('.header-leaf'),
		that = this

	// Select the clicked field
	var onTargetClick = function (event) {
		var fieldName = event.currentTarget.title,
			formattedFieldName = Panel.formatDocPath(fieldName)
		that._fieldButton.value = fieldName
		that._fieldButton.textContent = formattedFieldName
		that._nameInput.value = formattedFieldName
		that._nameInput.select()
		if (that.onchange) {
			that.onchange()
		}
	}

	// Finish the operation
	var dismiss = function (event) {
		if (event === originalEvent) {
			targets.forEach(function (target) {
				target.classList.add('plot-field-target')
				target.addEventListener('click', onTargetClick)
			})
			return
		}
		targets.forEach(function (target) {
			target.classList.remove('plot-field-target')
			target.removeEventListener('click', onTargetClick)
		})
		document.body.removeEventListener('click', dismiss)
	}

	// Set events
	document.body.addEventListener('click', dismiss)
}

/**
 * Return current field name
 * @returns {string}
 */
Plot.DataSelector.prototype.getField = function () {
	return this._fieldButton.value || ''
}

/**
 * Return current data name
 * @returns {string}
 */
Plot.DataSelector.prototype.getName = function () {
	return this._nameInput.value
}

/**
 * Show plot options
 */
Plot.start = function () {
	Panel.get('plot').style.display = 'none'
	Panel.get('plot-options').style.display = ''
}

/**
 * Hide plot options
 */
Plot.stop = function () {
	Panel.get('plot').style.display = ''
	Panel.get('plot-options').style.display = 'none'
}

/**
 * Add a new series at the given position
 * @param {number} [pos=-1] - default: at the end (0=first)
 * @returns {Plot~Series}
 */
Plot.addSeries = function (pos) {
	var series = {
		dataSelector: new Plot.DataSelector(Panel.create('span')),
		addEl: Panel.create('span.add'),
		deleteEl: Panel.create('span.delete')
	}

	// Create series
	series.el = Panel.create('li', [
		series.dataSelector.el,
		' ',
		series.addEl,
		' ',
		series.deleteEl
	])

	series.addEl.onclick = function () {
		Plot.addSeries(Plot.series.indexOf(series) + 1)
	}
	series.deleteEl.onclick = function () {
		Plot.deleteSeries(series)
	}
	series.dataSelector.onchange = Plot.update

	if (pos === -1 || pos === undefined || pos === Plot.series.length) {
		Panel.get('plot-series').appendChild(series.el)
		Plot.series.push(series)
	} else {
		Panel.get('plot-series').insertBefore(series.el, Plot.series[pos].el)
		Plot.series.splice(pos, 0, series)
	}

	return series
}

/**
 * @param {Plot~Series} series
 */
Plot.deleteSeries = function (series) {
	var pos = Plot.series.indexOf(series)
	if (pos === -1) {
		return
	}
	Plot.series.splice(pos, 1)
	series.el.parentElement.removeChild(series.el)
	Plot.update()
}

/**
 * Update the current plot
 */
Plot.update = function () {
	// Load current plot options
	var xField = Plot.xAxis.getField().split('.').filter(Boolean),
		xName = Plot.xAxis.getName(),
		series = Plot.series.map(function (series) {
			return {
				field: series.dataSelector.getField().split('.').filter(Boolean),
				name: series.dataSelector.getName()
			}
		}).filter(function (series) {
			// Ignore empty ones
			return series.field.length
		})

	if (!xField.length || !series.length || !Plot.ready || !Query.result || !Query.result.length) {
		// Not enough data
		return
	}

	// Create data table header
	var nCols = series.length + 1,
		nRows = Query.result.length + 1,
		header = new Array(nCols)
	header[0] = xName
	series.forEach(function (each, i) {
		header[i + 1] = each.name
	})

	// Load table data
	var body = new Array(nRows - 1),
		i, row, doc, xValue, j, yValue
	for (i = 1; i < nRows; i++) {
		row = new Array(series.length + 1)
		doc = Query.result[i - 1]

		// X value
		xValue = readField(doc, xField)
		if (xValue === undefined || xValue === null) {
			xValue = '(empty)'
		} else if (typeof xValue !== 'string' &&
			typeof xValue !== 'number' &&
			!(xValue instanceof Date)) {
			// Only strings, numbers and dates are allowed in the x axis
			continue
		}
		row[0] = xValue

		// Series
		for (j = 1; j < nCols; j++) {
			yValue = readField(doc, series[j - 1].field)
			if (typeof yValue !== 'number') {
				// Only numbers are allowed as series data
				yValue = null
			}
			row[j] = yValue
		}

		body[i - 1] = row
	}

	// Sort by x value
	if (typeof body[0][0] === 'string') {
		// String comparison
		body.sort(function (a, b) {
			var a0 = a[0],
				b0 = b[0]
			return a0 === b0 ? 0 : (a0 > b0 ? 1 : -1)
		})
	} else {
		// Numeric comparison
		body.sort(function (a, b) {
			var a0 = +a[0],
				b0 = +b[0]
			return a0 - b0
		})
	}

	// Create final table
	var table = new Array(nRows)
	table[0] = header
	for (i = 1; i < nRows; i++) {
		table[i] = body[i - 1]
	}

	// Draw plot
	var dataTable = google.visualization.arrayToDataTable(table),
		PlotClass, isStacked
	switch (Panel.value('plot-type')) {
		case 'area':
			PlotClass = google.visualization.AreaChart
			break
		case 'bar':
			PlotClass = google.visualization.BarChart
			break
		case 'column':
			PlotClass = google.visualization.ColumnChart
			break
		case 'line':
			PlotClass = google.visualization.LineChart
			break
	}
	switch (Panel.value('plot-stacked')) {
		case 'no':
			isStacked = false
			break
		case 'yes':
			isStacked = true
			break
		case 'percent':
			isStacked = 'percent'
			break
	}
	var chart = new PlotClass(Panel.get('plot-canvas'))
	chart.draw(dataTable, {
		title: Plot.titleInput.value,
		focusTarget: 'category',
		animation: {
			duration: 1e3
		},
		hAxis: {
			title: xName
		},
		isStacked: isStacked
	})

	/**
	 * Extract a field from the document
	 */
	function readField(doc, field) {
		var result = doc,
			i, len

		for (i = 0, len = field.length; i < len; i++) {
			if (!result || typeof result !== 'object') {
				break
			}
			result = result[field[i]]
		}

		return result
	}
}