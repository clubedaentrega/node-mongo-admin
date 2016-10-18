/*global Panel, Parse, Suggest, Query, Replacer*/
'use strict'

/**
 * Initialize auto completion engine in the given input field
 * @param {HTMLInputElement} el
 * @class
 */
function AutoComplete(el) {
	this._el = el
	this._open = false
	this._selectedIndex = 0
	this._listEl = Panel.create('div.auto-complete-results')
	this._listEl.style.display = 'none'
	this._el.parentElement.appendChild(this._listEl)

	/** @member {Suggest~Result} */
	this._suggestions = null
	this._lastValue = ''
	this._lastCursor = -1
	this._timer = null

	el.addEventListener('input', () => this._suggest())
	el.addEventListener('keydown', event => {
		if (!this._open) {
			return
		}

		if (event.key === 'ArrowDown') {
			this._select(this._selectedIndex + 1)
			event.preventDefault()
		} else if (event.key === 'ArrowUp') {
			this._select(this._selectedIndex - 1)
			event.preventDefault()
		} else if (event.key === 'Tab') {
			this._accept()
			event.preventDefault()
		} else if (event.key === 'Escape') {
			this._close()
			event.preventDefault()
		}
	})

	el.addEventListener('focus', () => {
		// Use pooling interval since there is no event to tell
		// us the cursor has changed position.
		// Another way would be to listen to 'click', 'mousemove', etc
		clearInterval(this._timer)
		this._timer = setInterval(() => this._suggest(), 500)
	})
	el.addEventListener('blur', () => {
		clearInterval(this._timer)
		setTimeout(() => {
			this._lastValue = ''
			this._close()
		}, 100)
	})
}

/**
 * @property {Object<?Sample~Schema>} - schema by connection+'.'+collection (null if loading)
 * @private
 */
AutoComplete._schemaCache = {}

/**
 * Load schema memory cache (or start loading process)
 * @returns {?Sample~Schema}
 * @private
 */
AutoComplete._loadSchema = function () {
	let cacheKey = Query.connection + '.' + Query.collection,
		cached = AutoComplete._schemaCache[cacheKey]

	if (cached) {
		return cached
	} else if (cached === null) {
		// Loading started, be patient
		return
	}

	// Load
	AutoComplete._schemaCache[cacheKey] = null
	Panel.request('sample', {
		connection: Query.connection,
		collection: Query.collection
	}, function (out) {
		if (!out) {
			// Error
			delete AutoComplete._schemaCache[cacheKey]
		}

		AutoComplete._schemaCache[cacheKey] = out.schema
	})
}

/**
 * Prepare suggestions to display
 * @private
 */
AutoComplete.prototype._suggest = function () {
	let schema = AutoComplete._loadSchema()

	if (!schema) {
		// Not ready yet
		return
	}

	// Load suggestions
	let value = this._el.value,
		cursor = this._el.selectionStart || 0,
		cursorEnd = this._el.selectionEnd || 0

	if (cursor !== cursorEnd) {
		return this._close()
	} else if (value === this._lastValue && cursor === this._lastCursor) {
		// Nothing has changed
		return
	}

	let parsed = Parse.parse('{' + value + '}', cursor + 1),
		suggestions = Suggest.getSuggestions(parsed, schema)
	this._lastValue = value
	this._lastCursor = cursor

	// Display in the screen
	let rect = this._el.getBoundingClientRect()
	this._listEl.innerHTML = ''
	this._listEl.style.display = ''
	this._listEl.style.left = 'calc(' + rect.left + 'px + ' + cursor + 'ch)'

	this._suggestions = suggestions

	if (!suggestions || !suggestions.texts.length) {
		return this._close()
	}

	this._open = true
	suggestions.texts.forEach((each, i) => {
		let itemEl = Panel.create('div.auto-complete-result', each)

		itemEl.onmouseover = () => {
			this._select(i)
		}
		itemEl.onclick = () => {
			this._select(i)
			this._accept()
		}

		this._listEl.appendChild(itemEl)
	})

	this._select(0)
}

/**
 * @private
 */
AutoComplete.prototype._close = function () {
	this._open = false
	this._listEl.style.display = 'none'
}

/**
 * Apply the replacement
 * @private
 */
AutoComplete.prototype._accept = function () {
	let replaced = Replacer.replace('{' + this._lastValue + '}',
		this._suggestions.texts[this._selectedIndex],
		this._suggestions.type,
		this._suggestions.context)

	if (!replaced) {
		return
	}

	this._el.value = replaced.text.slice(1, -1)
	this._el.selectionStart = this._el.selectionEnd = replaced.cursor - 1
	this._el.dispatchEvent(new window.InputEvent('input'))

	// Open new suggestion (if any)
	this._suggest()
}

/**
 * Select the given index (wraps between 0 and MAX)
 * @param {number} index
 * @private
 */
AutoComplete.prototype._select = function (index) {
	if (!this._suggestions) {
		return
	}

	// Unselect
	let prev = this._listEl.children[this._selectedIndex]
	if (prev) {
		prev.classList.remove('active')
	}

	// Wrap index
	let len = this._suggestions.texts.length
	index = ((index % len) + len) % len

	// Select
	this._listEl.children[index].classList.add('active')
	this._selectedIndex = index
}