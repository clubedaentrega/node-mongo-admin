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
	var key = this.prefix + conn + '.' + coll,
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
		this.splice.apply(this, [0, this.length].concat(arr))
		this.save()
	}

	return arr
}

/**
 * Simple global value
 * @param {string} name
 * @returns {*}
 */
Storage.get = function (name) {
	var key = 'node-mongo-admin.' + name
	return JSON.parse(localStorage.getItem(key) || 'null')
}

/**
 * Simple global value
 * @param {string} name
 * @param {*} value
 */
Storage.set = function (name, value) {
	var key = 'node-mongo-admin.' + name
	localStorage.setItem(key, JSON.stringify(value))
}