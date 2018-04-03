'use strict'

/**
 * Manage stored array data indexed by connection.collection
 * @class
 * @param {string} id - unique name for this storage
 */
function Storage(id) {
	this.prefix = 'node-mongo-admin.' + id + '.'
}

/**
 * @param {string} conn
 * @param {string} coll
 * @returns {Array}
 */
Storage.prototype.getArray = function (conn, coll) {
	let key = this.prefix + conn + '.' + coll,
		arr = JSON.parse(localStorage.getItem(key) || '[]')

	arr.save = function () {
		localStorage.setItem(key, JSON.stringify(this))
	}

	arr.pushAndSave = function (value) {
		this.push(value)
		this.save()
	}

	arr.clear = function () {
		this.splice(0, this.length)
		localStorage.removeItem(key)
	}

	arr.set = function (arr) {
		this.splice(0, this.length, ...arr)
		this.save()
	}

	return arr
}

Storage.cache = Object.create(null)

/**
 * Simple global value, updates cached value
 * @param {string} name
 * @returns {*}
 */
Storage.get = function (name) {
	let key = 'node-mongo-admin.' + name,
		result = JSON.parse(localStorage.getItem(key) || 'null')
	Storage.cache[name] = result
	return result
}

/**
 * Read cached value (if available)
 * @param {string} name
 * @returns {?*}
 */
Storage.getCached = function (name) {
	return Storage.cache[name]
}

/**
 * Simple global value
 * @param {string} name
 * @param {*} value
 */
Storage.set = function (name, value) {
	let key = 'node-mongo-admin.' + name
	localStorage.setItem(key, JSON.stringify(value))
}