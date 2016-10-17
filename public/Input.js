/*globals Panel, AutoComplete*/
'use strict'

/**
 * Handle our custom text input implementation
 * The main reason we need this is to allow the user copy the resulting
 * query as text
 * @param {HTMLElement} el
 * @param {boolean} [enableAutoComplete=false]
 * @class
 */
function Input(el, enableAutoComplete) {
	var that = this

	/** @member {HTMLElement} */
	this.el = Panel.get(el)

	/** @member {?function()} */
	this.oninput = null

	/**
	 * @member {string} value
	 */
	Object.defineProperty(this, 'value', {
		get: function () {
			return this._inputEl.value
		},
		set: function (newValue) {
			this._inputEl.value = newValue
			this._inputEl.style.width = (this._inputEl.value.length + 1) + 'ch'
		}
	})

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._inputEl = document.createElement('input')

	// Build internal HTML
	this.el.classList.add('custom-input')
	this.el.appendChild(this._inputEl)
	this._inputEl.oninput = function () {
		that._inputEl.style.width = (that._inputEl.value.length + 2) + 'ch'
		if (that.oninput) {
			that.oninput.call(that)
		}
	}

	if (enableAutoComplete) {
		this._autoComplete = new AutoComplete(this._inputEl)
	}
}

/**
 * Focus the input
 */
Input.prototype.select = function () {
	this._inputEl.select()
}

/**
 * @param {boolean} disabled
 */
Input.prototype.setDisabled = function (disabled) {
	this._inputEl.disabled = disabled
}