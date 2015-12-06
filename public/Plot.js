/*globals Panel, Input, google, Query, DataSelector*/
'use strict'

var Plot = {
	types: {
		area: {
			className: 'AreaChart',
			allowStacked: true,
			focusTarget: 'category'
		},
		bar: {
			className: 'BarChart',
			allowStacked: true,
			focusTarget: 'category'
		},
		column: {
			className: 'ColumnChart',
			allowStacked: true,
			focusTarget: 'category'
		},
		line: {
			className: 'LineChart',
			allowStacked: false,
			focusTarget: 'category'
		},
		histogram: {
			className: 'Histogram',
			allowStacked: true,
			focusTarget: undefined
		},
		pie: {
			className: 'PieChart',
			allowStacked: false
		}
	},
	/**
	 * Whether google charts has loaded
	 * @property {boolean}
	 */
	ready: false,
	chart: null
}

/**
 * @typedef {Object} Plot~Series
 * @property {HTMLElement} el
 * @property {DataSelector} dataSelector
 * @property {HTMLElement} addEl
 * @property {HTMLElement} deleteEl
 */

/**
 * Bind DOM events
 */
Plot.init = function () {
	Panel.get('plot').onclick = Plot.start
	Panel.get('plot-clear').onclick = Plot.stop
	Panel.get('plot-type').onchange = Plot.update
	Panel.get('plot-stacked').onchange = Plot.update
	Plot.titleInput = new Input('plot-title')
	Plot.titleInput.oninput = Plot.update
	Plot.xAxis = new DataSelector('plot-x-axis')
	Plot.xAxis.onchange = Plot.update
	Plot.series = []
	Panel.get('plot-add-series').onclick = function () {
		Plot.addSeries(0)
	}
	Plot.addSeries(0, true)
	Panel.get('plot-export').onclick = function () {
		if (!Plot.chart) {
			return
		}

		window.open(Plot.chart.getImageURI())
	}
	Panel.get('plot-set-size').onclick = function () {
		var plotStyle = Panel.get('plot-wrapper').style,
			current = parseInt(plotStyle.width) + ' x ' + parseInt(plotStyle.height),
			newSize = prompt('Set size in pixels (width x height)', current),
			pos, newWidth, newHeight

		if (newSize && (pos = newSize.indexOf('x')) !== -1) {
			newWidth = parseInt(newSize.substr(0, pos), 10)
			newHeight = parseInt(newSize.substr(pos + 1), 10)
			if (newWidth && newHeight) {
				plotStyle.width = parseInt(newWidth, 10) + 'px'
				plotStyle.height = parseInt(newHeight, 10) + 'px'
				Plot.updatePlot()
			}
		}
	}

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
 * @param {boolean} [skipSelection] - if true, does not start field selection
 * @returns {Plot~Series}
 */
Plot.addSeries = function (pos, skipSelection) {
	var series = {
		dataSelector: new DataSelector(Panel.create('span')),
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

	Plot.update()
	if (!skipSelection) {
		setTimeout(function () {
			series.dataSelector.selectField()
		}, 0)
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
 * Update the current plot and the options interface
 */
Plot.update = function () {
	var type = Panel.value('plot-type'),
		plotType = Plot.types[type],
		numSeries = Plot.series.filter(function (series) {
			return series.dataSelector.getField()
		}).length
	Panel.get('plot-stacked').style.display = plotType.allowStacked ? '' : 'none'

	if (type === 'histogram' && numSeries === 1) {
		Panel.get('plot-x-axis-label').textContent = 'Data name'
		Plot.xAxis.setInputDisabled(true)
	} else {
		Panel.get('plot-x-axis-label').textContent = 'X axis'
		Plot.xAxis.setInputDisabled(false)
	}
	Plot.xAxis.setFieldDisabled(type === 'histogram' && numSeries > 1)

	Plot.updatePlot()
}

/**
 * Update the current plot
 */
Plot.updatePlot = function () {
	// Load current plot options
	var xField = Plot.xAxis.getField().split('.').filter(Boolean),
		xName = Plot.xAxis.getName(),
		type = Panel.value('plot-type'),
		plotType = Plot.types[type],
		series = Plot.series.map(function (series) {
			return {
				field: series.dataSelector.getField().split('.').filter(Boolean),
				name: series.dataSelector.getName()
			}
		}).filter(function (series) {
			// Ignore empty ones
			return series.field.length
		}),
		hasX = type !== 'histogram' || series.length < 2,
		xOffset = hasX ? 1 : 0

	if ((hasX && !xField.length) ||
		!series.length ||
		!Plot.ready ||
		!Query.result ||
		!Query.result.length) {
		// Not enough data
		return
	}

	// Create data table header
	var nCols = xOffset + series.length,
		nRows = Query.result.length + 1,
		header = new Array(nCols)
	if (hasX) {
		header[0] = xName
	}
	series.forEach(function (each, i) {
		header[i + xOffset] = each.name
	})

	// Load table data
	var body = new Array(nRows - 1),
		i, row, doc, xValue, j, yValue
	for (i = 1; i < nRows; i++) {
		row = new Array(nCols)
		doc = Query.result[i - 1]

		// X value
		if (hasX) {
			xValue = readField(doc, xField)
			if (typeof xValue !== 'string' &&
				typeof xValue !== 'number' &&
				!(xValue instanceof Date)) {
				// Only strings, numbers and dates are allowed in the x axis
				xValue = String(xValue)
			} else if (type === 'histogram') {
				// For one-series histogram, x must be a string
				xValue = String(xValue)
			}
			row[0] = xValue
		}

		// Series
		for (j = xOffset; j < nCols; j++) {
			yValue = readField(doc, series[j - xOffset].field)
			if (typeof yValue !== 'number') {
				// Only numbers are allowed as series data
				yValue = null
			}
			row[j] = yValue
		}

		body[i - 1] = row
	}

	if (hasX && typeof body[0][0] !== 'string') {
		// Sort by x numeric value
		// This avoid google charts visual glitches with non-monotonic x values
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
		PlotClass = google.visualization[plotType.className],
		options = {
			title: Plot.titleInput.value,
			focusTarget: plotType.focusTarget,
			hAxis: {
				title: xName
			}
		}

	if (type === 'histogram' && series.length === 1) {
		options.legend = {
			position: 'none'
		}
		options.hAxis.title = series[0].name
	}

	if (type === 'pie') {
		// Group small slices into 'Other'
		options.sliceVisibilityThreshold = 0.01
	}

	if (plotType.allowStacked) {
		switch (Panel.value('plot-stacked')) {
			case 'no':
				options.isStacked = false
				break
			case 'yes':
				options.isStacked = true
				break
			case 'percent':
				options.isStacked = 'percent'
				break
		}
	}

	Plot.chart = new PlotClass(Panel.get('plot-canvas'))
	Plot.chart.draw(dataTable, options)

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