'use strict'

let readPreference = require('../readPreference')

module.exports.fields = {
	connection: String,
	collection: String,
	stages: [{
		operator: 'in($addFields, $bucket, $bucketAuto, $collStats, $count, $currOp, $facet, $geoNear, $graphLookup, $group, $indexStats, $limit, $listLocalSessions, $listSessions, $lookup, $match, $project, $redact, $replaceRoot, $sample, $skip, $sort, $sortByCount, $unwind)',
		operand: '*'
	}]
}

module.exports.handler = function (dbs, body, success, error) {
	console.log(JSON.stringify({
		op: 'aggregate',
		connection: body.connection,
		collection: body.collection,
		stages: body.stages.map(stage => {
			let obj = {}

			if (stage.operand && typeof stage.operand === 'object' && stage.operand.__raw) {
				obj[stage.operator] = stage.operand.__raw
				delete stage.operand.__raw
			} else {
				obj[stage.operator] = stage.operand
			}
			return obj
		})
	}))

	let db = dbs[body.connection],
		stages

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	stages = body.stages.map(stage => {
		let ret = {}
		ret[stage.operator] = stage.operand
		return ret
	})

	db.collection(body.collection).aggregate(stages, {
		readPreference: readPreference(body.collection)
	}).toArray((err, docs) => {
		if (err) {
			return error(err)
		}
		success({
			docs
		})
	})
}