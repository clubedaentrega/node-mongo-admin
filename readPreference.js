'use strict'

let ReadPreference = require('mongodb').ReadPreference

module.exports = function (collection) {
	return collection === 'system.profile' ?
		ReadPreference.PRIMARY_PREFERRED :
		ReadPreference.SECONDARY_PREFERRED
}