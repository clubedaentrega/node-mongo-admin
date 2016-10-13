'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	stages: [{
		operator: 'in($geoNear, $group, $limit, $match, $project, $redact, $skip, $sort, $unwind, $sample, $indexStats, $lookup)',
		operand: '*'
	}]
}

module.exports.handler = function (dbs, body, success, error) {
	console.log(JSON.stringify({
		op: 'aggregate',
		connection: body.connection,
		collection: body.collection,
		stages: body.stages.map(function (stage) {
			var obj = {}

			if (stage.operand && typeof stage.operand === 'object' && stage.operand.__raw) {
				obj[stage.operator] = stage.operand.__raw
				delete stage.operand.__raw
			} else {
				obj[stage.operator] = stage.operand
			}
			return obj
		})
	}))

	var db = dbs[body.connection],
		stages

	if (!db) {
		return error(200, 'Invalid connection name')
	}

	stages = body.stages.map(function (stage) {
		var ret = {}
		ret[stage.operator] = stage.operand
		return ret
	})

	db.collection(body.collection).aggregate(stages, function (err, docs) {
		if (err) {
			return error(err)
		}
		success({
			docs: docs
		})
	})
}