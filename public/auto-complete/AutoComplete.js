/*global Panel, Parse, Suggest, Query*/
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

	el.addEventListener('input', () => {
		this._suggest()
	})

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
		} else if (event.key === 'Enter') {
			this._accept()
			event.preventDefault()
		} else if (event.key === 'Escape') {
			this._close()
			event.preventDefault()
		}
	})

	el.addEventListener('blur', () => {
		this._close()
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

		console.log('loaded')
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

	let parsed = Parse.parse('{' + this._el.value + '}', (this._el.selectionStart || 0) + 1),
		suggestions = Suggest.getSuggestions(parsed, schema)

	console.log(suggestions)
}

AutoComplete.prototype._close = function () {}

AutoComplete.prototype._accept = function () {}

AutoComplete.prototype._select = function () {}