/*globals Panel*/
'use strict'

/**
 * Handle our custom select implementation
 * The main reason we need this is to allow the user copy the resulting
 * query as text
 * @param {HTMLElement} el
 * @class
 */
function Select(el) {
	var that = this

	/** @member {HTMLElement} */
	this.el = Panel.get(el)

	/** @member {?function()} */
	this.onchange = null

	/**
	 * @member {string} value
	 */
	Object.defineProperty(this, 'value', {
		get: function () {
			return this._selectEl.value
		},
		set: function (newValue) {
			this._selectEl.value = newValue
			this.showLabel()
		}
	})

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._selectEl = document.createElement('select')

	/**
	 * @member {HTMLElement}
	 * @private
	 */
	this._labelEl = document.createElement('span')

	// Build internal HTML
	this.el.classList.add('custom-select')
	this.el.appendChild(this._labelEl)
	this.el.appendChild(this._selectEl)
	this._selectEl.style.display = 'none'
	this._labelEl.onclick = this.showSelect.bind(this)
	this._selectEl.onchange = function () {
		that.showLabel()
		if (that.onchange) {
			that.onchange.call(that)
		}
	}
	this._selectEl.onblur = this.showLabel.bind(this)
	this._labelEl.textContent = ' '
}

/**
 * @param {Array<string|{value: string, text: string}>} options
 */
Select.prototype.setOptions = function (options) {
	this._selectEl.innerHTML = ''
	options.forEach(function (each) {
		var optionEl = document.createElement('option')
		if (typeof each === 'object') {
			optionEl.value = each.value
			optionEl.textContent = each.text
		} else {
			optionEl.value = optionEl.textContent = each
		}
		this._selectEl.appendChild(optionEl)
	}, this)
	this.showLabel()
}

/**
 * Hide the select box and show the label
 */
Select.prototype.showLabel = function () {
	this._labelEl.style.display = ''
	this._selectEl.style.display = 'none'
	this._labelEl.textContent = this._selectEl.value || ' '
}

/**
 * Hide the label and show the select box
 */
Select.prototype.showSelect = function () {
	this._labelEl.style.display = 'none'
	this._selectEl.style.display = ''
}