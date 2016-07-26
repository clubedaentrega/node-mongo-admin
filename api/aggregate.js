'use strict'

module.exports.fields = {
	connection: String,
	collection: String,
	stages: [{
		operator: 'in($geoNear, $group, $limit, $match, $project, $redact, $skip, $sort, $unwind, $sample, $indexStats)',
		operand: '*'
	}]
}

module.exports.handler = function (dbs, body, success, error) {
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