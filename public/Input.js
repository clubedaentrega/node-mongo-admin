/*globals Panel*/
'use strict'

/**
 * Handle our custom text input implementation
 * The main reason we need this is to allow the user copy the resulting
 * query as text
 * @param {HTMLElement} el
 * @class
 */
function Input(el) {
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
			this.showLabel()
		}
	})

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._inputEl = document.createElement('input')

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._labelEl = document.createElement('span')

	// Build internal HTML
	this.el.classList.add('custom-input')
	this.el.appendChild(this._labelEl)
	this.el.appendChild(this._inputEl)
	this._inputEl.style.display = 'none'
	this._labelEl.onclick = this.showInput.bind(this)
	this._inputEl.oninput = function () {
		that._inputEl.style.width = (that._inputEl.value.length + 1) + 'ch'
		if (that.oninput) {
			that.oninput.call(that)
		}
	}
	this._inputEl.onblur = this.showLabel.bind(this)
	this._labelEl.textContent = ' '
}

/**
 * Hide the text input and show the label
 */
Input.prototype.showLabel = function () {
	this._labelEl.style.display = ''
	this._inputEl.style.display = 'none'
	this._labelEl.textContent = this._inputEl.value || ' '
}

/**
 * Hide the label and show the text input
 */
Input.prototype.showInput = function () {
	this._labelEl.style.display = 'none'
	this._inputEl.style.display = ''
	this._inputEl.style.width = (this._inputEl.value.length + 1) + 'ch'
	this._inputEl.focus()
}