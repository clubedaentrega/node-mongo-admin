/* globals Panel*/
'use strict'

/**
 * Handle our custom select implementation
 * The main reason we need this is to allow the user copy the resulting
 * query as text
 * @param {HTMLElement} el
 * @class
 */
function Select(el) {
	let that = this

	/** @member {HTMLElement} */
	this.el = Panel.get(el)

	/** @member {?function()} */
	this.onchange = null

	/**
	 * @member {string} value
	 */
	Object.defineProperty(this, 'value', {
		get() {
			return this._selectEl.value
		},
		set(newValue) {
			this._selectEl.value = newValue
		}
	})

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._selectEl = document.createElement('select')

	// Build internal HTML
	this.el.classList.add('custom-select')
	this.el.appendChild(this._selectEl)
	this._selectEl.onchange = function () {
		if (that.onchange) {
			that.onchange()
		}
	}
}

/**
 * @param {Array<string|{value: string, text: string}>} options
 */
Select.prototype.setOptions = function (options) {
	this._selectEl.innerHTML = ''
	options.forEach(function (each) {
		let optionEl = document.createElement('option')
		if (typeof each === 'object') {
			optionEl.value = each.value
			optionEl.textContent = each.text
		} else {
			optionEl.value = optionEl.textContent = each
		}
		this._selectEl.appendChild(optionEl)
	}, this)
}