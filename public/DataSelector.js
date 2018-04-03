/* globals Panel, Input*/
'use strict'

/**
 * @class
 * @param {string|HTMLElement} el
 */
function DataSelector(el) {
	let that = this

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
 * @param {Event} [originalEvent]
 */
DataSelector.prototype.selectField = function (originalEvent) {
	let targets = Panel.getAll('.header-leaf'),
		that = this

	this._fieldButton.focus()

	// Select the clicked field
	let onTargetClick = function (event) {
		let fieldName = event.currentTarget.title,
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
	let dismiss = function (event) {
		if (event === originalEvent) {
			return
		}
		targets.forEach(target => {
			target.classList.remove('plot-field-target')
			target.removeEventListener('click', onTargetClick)
		})
		document.body.removeEventListener('click', dismiss)
	}

	// Set events
	document.body.addEventListener('click', dismiss)
	setTimeout(() => {
		targets.forEach(target => {
			target.classList.add('plot-field-target')
			target.addEventListener('click', onTargetClick)
		})
	}, 0)
}

/**
 * Return current field name
 * @returns {string}
 */
DataSelector.prototype.getField = function () {
	return this._fieldButton.value || ''
}

/**
 * Return current data name
 * @returns {string}
 */
DataSelector.prototype.getName = function () {
	return this._nameInput.value
}

/**
 * Disable/Enable field selection button
 * @param {boolean} disabled
 */
DataSelector.prototype.setFieldDisabled = function (disabled) {
	this._fieldButton.disabled = disabled
}

/**
 * Disable/Enable name input
 * @param {boolean} disabled
 */
DataSelector.prototype.setInputDisabled = function (disabled) {
	this._nameInput.setDisabled(disabled)
}