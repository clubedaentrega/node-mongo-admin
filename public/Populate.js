/*globals Storage, Query, ObjectId, Panel, Populated*/
/**
 * @file Manage populate operations
 */
'use strict'

var Populate = {}

/**
 * Registered populate operations
 * @property {Storage}
 */
Populate.paths = new Storage('populate')

/**
 * Create and run a populate operation
 * @param {string} conn
 * @param {string} coll
 * @param {string} path
 * @param {string} targetConn
 * @param {string} targetColl
 * @param {string} targetPath
 */
Populate.create = function (conn, coll, path, targetConn, targetColl, targetPath) {
	var op = {
		path: path,
		targetConn: targetConn,
		targetColl: targetColl,
		targetPath: targetPath
	}
	Populate.paths.getArray(conn, coll).pushAndSave(op)
	Populate.run(op)
}

/**
 * Remove a populate operation
 * @param {string} conn
 * @param {string} coll
 * @param {string} path
 */
Populate.remove = function (conn, coll, path) {
	var ops = Populate.paths.getArray(conn, coll)
	ops.set(ops.filter(function (op) {
		return op.path !== path && path.indexOf(op.path + '.') !== 0
	}))
	// TODO: find a better way of doing this (restore original data for all Populated instances)
	window.location.reload()
}

/**
 * Run all operations related to a collection
 * @param {string} conn
 * @param {string} coll
 */
Populate.runAll = function (conn, coll) {
	Populate.paths.getArray(conn, coll).forEach(Populate.run)
}

/**
 * Return all paths that are/will be populate
 * @param {string} conn
 * @param {string} coll
 * @returns {Array<string>}
 */
Populate.getPaths = function (conn, coll) {
	return Populate.paths.getArray(conn, coll).map(function (op) {
		return op.path
	})
}

/**
 * Check whether a given path is populated
 * @param {Array<string>} paths - populated paths (returned by getPaths)
 * @param {string} path - path to check
 * @returns {boolean}
 */
Populate.isPopulated = function (paths, path) {
	return paths.some(function (each) {
		return each === path || path.indexOf(each + '.') === 0
	})
}

/**
 * Run a given populate operation
 * @param {Object} op
 */
Populate.run = function (op) {
	var replaceSites = Object.create(null),
		pathParts = op.path.split('.'),
		ids

	// Collect ids to replace
	Query.result.forEach(function (doc) {
		var i, parent
		for (i = 0; i < pathParts.length; i++) {
			if (!doc ||
				typeof doc !== 'object' ||
				Array.isArray(doc) ||
				Query.specialTypes.indexOf(doc.constructor) !== -1) {
				return
			}
			parent = doc
			doc = doc[pathParts[i]]
		}

		if (doc instanceof ObjectId) {
			if (!(doc in replaceSites)) {
				replaceSites[doc] = []
			}
			replaceSites[doc].push(parent)
		}
	})
	ids = Object.keys(replaceSites)

	// Find in the DB
	if (!ids.length) {
		return
	}
	Panel.request('populate', {
		connection: op.targetConn,
		collection: op.targetColl,
		ids: ids,
		path: op.targetPath
	}, function (result) {
		var parentPath = pathParts[pathParts.length - 1],
			parts = op.targetPath.split('.')
		result.docs.forEach(function (doc) {
			replaceSites[doc._id].forEach(function (each) {
				var original = each[parentPath],
					display = op.targetPath ? getInPath(doc, parts) : doc
				each[parentPath] = new Populated(original, display)
			})
		})
		Query.populateResultTable()
	})

	// return doc[path], but considering sub-docs
	function getInPath(doc, parts) {
		var i
		for (i = 0; i < parts.length; i++) {
			if (!doc ||
				typeof doc !== 'object' ||
				Array.isArray(doc) ||
				Query.specialTypes.indexOf(doc.constructor) !== -1) {
				return
			}
			doc = doc[parts[i]]
		}
		return doc
	}
}