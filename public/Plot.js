/*globals Panel, Input*/
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
	Plot.titleInput = new Input('plot-title')
	Plot.xAxis = new Plot.DataSelector('plot-x-axis')
	Plot.series = []
	Panel.get('plot-add-series').onclick = function () {
		Plot.addSeries(0)
	}
	Plot.addSeries()
}

window.addEventListener('load', Plot.init)

/**
 * @class
 * @param {string|HTMLElement} el
 */
Plot.DataSelector = function (el) {
	this.el = Panel.get(el)

	// Construct internal DOM (a button and a text input)
	this.fieldButton = Panel.create('button', 'Select field')
	this.nameInput = new Input(Panel.create('span'))
	this.el.appendChild(this.fieldButton)
	this.el.appendChild(Panel.create('span', ', name: '))
	this.el.appendChild(this.nameInput.el)
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
}