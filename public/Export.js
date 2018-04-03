/**
 * @file Manage the export feature
 */
/* globals Panel, ObjectId, BinData, DBRef, MinKey, MaxKey, Long, Storage*/
'use strict'

let Export = {}

Export.specialTypes = [ObjectId, BinData, Long, Date, RegExp]

/**
 * Start the export process
 * @param {Array<Object>} docs
 * @param {string} title
 * @param {string} [queryString] - the query as a string to show in the file
 * @returns {string} - an object url
 */
Export.export = function (docs, title, queryString) {
	/**
	 * A map from path name to array of values
	 * @type {Object<Array<*>>}
	 */
	let valuesByPath = Object.create(null),
		blob

	/**
	 * Recursive function to extract subdocuments and field values
	 * @param {Object} subdoc
	 * @param {string} path
	 * @param {number} i
	 */
	function addSubDoc(subdoc, path, i) {
		let key, value, subpath
		for (key in subdoc) {
			subpath = path ? path + '.' + key : key
			value = subdoc[key]

			// These types aren't supported
			if (Array.isArray(value) ||
				value instanceof DBRef ||
				value instanceof MinKey ||
				value instanceof MaxKey) {
				continue
			}

			if (value &&
				typeof value === 'object' &&
				Export.specialTypes.indexOf(value.constructor) === -1) {
				addSubDoc(value, subpath, i)
			} else {
				// Primitive value
				if (!(subpath in valuesByPath)) {
					// New result path
					valuesByPath[subpath] = []
				}
				valuesByPath[subpath][i] = value
			}
		}
	}

	docs.forEach((doc, i) => {
		addSubDoc(doc, '', i)
	})

	blob = new Blob([Export.generateHTML(valuesByPath, docs.length, title, queryString)], {
		type: 'text/html'
	})
	return window.URL.createObjectURL(blob)
}

/**
 * Create a HTML document from a value map
 * @param {Object<Array<*>>} valuesByPath
 * @param {number} length - number of docs
 * @param {string} title
 * @param {string} [paragraph] - text to display before the table
 * @returns {string}
 */
Export.generateHTML = function (valuesByPath, length, title, paragraph) {
	let localDate = Boolean(Storage.get('localDate')),
		html, pathNames, i

	// HTML head
	html = '<!DOCTYPE html>\n' +
		'<html>\n' +
		'<head>\n' +
		'<title>' + Panel.escape(title) + '</title>\n' +
		'<meta charset="UTF-8">\n' +
		'</head>\n' +
		'<body>\n'

	pathNames = Object.keys(valuesByPath).sort()

	// Title
	html += '<h1>' + Panel.escape(title) + '</h1>'
	if (paragraph) {
		html += '<p>' + Panel.escape(paragraph) + '</p>'
	}
	html += '<p>Exported at ' + new Date().toISOString() + '</p>'

	// Table header
	html += '<table border="1">\n' +
		'<tr>\n'
	pathNames.forEach(path => {
		html += '<th>' + Panel.escape(Panel.formatDocPath(path)) + '</th>'
	})
	html += '</tr>\n'

	// Rows
	function generateRow(i) {
		html += '<tr>\n'
		pathNames.forEach(path => {
			html += '<td>' +
				Panel.escape(Export.toString(valuesByPath[path][i], localDate)) +
				'</td>'
		})
		html += '</tr>\n'
	}
	for (i = 0; i < length; i++) {
		generateRow(i)
	}

	// Footer
	html += '</body>\n' +
		'</html>'

	return html
}

/**
 * @param {*} value
 * @param {boolean} [localDate] - show date in local (browser) time
 * @returns {string}
 */
Export.toString = function (value, localDate) {
	if (value === undefined) {
		return ''
	} else if (value instanceof BinData) {
		return value.$binary
	} else if (value instanceof Long) {
		return value.$numberLong
	} else if (value instanceof Date) {
		return localDate ? value.toLocaleString() : value.toISOString()
	}
		// ObjectId, RegExp and others
		return String(value)

}