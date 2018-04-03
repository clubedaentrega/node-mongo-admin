/**
 * @file Helper date function
 */
'use strict'

/**
 * Valid date formats:
 * - today, yesterday, tomorrow, now
 * - %d %unit ago
 * - %d %unit from now
 * - last %unit
 * - next %unit
 * - this %unit
 *
 * Valid range formats:
 * - since %date
 * - up to %date
 * - from %date to %date
 *
 * Valid unit names:
 * - s, second, seconds
 * - min, minute, minutes
 * - h, hour, hours
 * - d, day, days
 * - w, week, weeks
 * - mo, month, months
 * - yr, year, years
 * @param {string} str
 * @returns {Object|Date} - a single Date instance of a query obj like {$gt:...}
 * @throws if could not understand the date string
 */
function date(str) { // eslint-disable-line no-unused-vars
	str = String(str)

	return parseRange(str) || parseDate(str) || error(str, 'date or range')

	function parseRange(str) {
		let match
		if ((match = str.match(/^since (.*)$/))) {
			return {
				$gt: parseDate(match[1]) || error(match[1], 'date')
			}
		} else if ((match = str.match(/^up to (.*)$/))) {
			return {
				$lt: parseDate(match[1]) || error(match[1], 'date')
			}
		} else if ((match = str.match(/^from (.*) to (.*)$/))) {
			return {
				$gt: parseDate(match[1]) || error(match[1], 'date'),
				$lt: parseDate(match[2]) || error(match[2], 'date')
			}
		}
	}

	function parseDate(str) {
		let now = new Date,
			today = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
			match, n, unit
		if (str === 'now') {
			return now
		} else if (str === 'today') {
			return today
		} else if (str === 'yesterday') {
			today.setDate(today.getDate() - 1)
			return today
		} else if (str === 'tomorrow') {
			today.setDate(today.getDate() + 1)
			return today
		} else if ((match = str.match(/^(\d+) (.*) (ago|from now)$/))) {
			n = Number(match[1]) * (match[3] === 'ago' ? -1 : 1)
			unit = parseUnit(match[2])
			if (unit === 's') {
				now.setSeconds(now.getSeconds() + n)
			} else if (unit === 'min') {
				now.setMinutes(now.getMinutes() + n)
			} else if (unit === 'h') {
				now.setHours(now.getHours() + n)
			} else if (unit === 'd') {
				now.setDate(now.getDate() + n)
			} else if (unit === 'w') {
				now.setDate(now.getDate() + n * 7)
			} else if (unit === 'mo') {
				now.setMonth(now.getMonth() + n)
			} else if (unit === 'yr') {
				now.setFullYear(now.getFullYear() + n)
			}
			return now
		} else if ((match = str.match(/^(last|next|this) (.*)$/))) {
			n = match[1] === 'last' ? -1 : (match[1] === 'next' ? 1 : 0)
			unit = parseUnit(match[2])
			if (unit === 's') {
				now.setSeconds(now.getSeconds() + n, 0)
			} else if (unit === 'min') {
				now.setMinutes(now.getMinutes() + n, 0, 0)
			} else if (unit === 'h') {
				now.setHours(now.getHours() + n, 0, 0, 0)
			} else if (unit === 'd') {
				now.setHours(0, 0, 0, 0)
				now.setDate(now.getDate() + n)
			} else if (unit === 'w') {
				now.setHours(0, 0, 0, 0)
				now.setDate(now.getDate() - now.getDay())
				now.setDate(now.getDate() + n * 7)
			} else if (unit === 'mo') {
				now.setHours(0, 0, 0, 0)
				now.setMonth(now.getMonth() + n, 1)
			} else if (unit === 'yr') {
				now.setHours(0, 0, 0, 0)
				now.setFullYear(now.getFullYear() + n, 0, 1)
			}
			return now
		}
	}

	function parseUnit(str) {
		let units = {
			__proto__: null,
			s: 's',
			second: 's',
			seconds: 's',
			min: 'min',
			minute: 'min',
			minutes: 'min',
			h: 'h',
			hour: 'h',
			hours: 'h',
			d: 'd',
			day: 'd',
			days: 'd',
			w: 'w',
			week: 'w',
			weeks: 'w',
			mo: 'mo',
			month: 'mo',
			months: 'mo',
			yr: 'yr',
			year: 'yr',
			years: 'yr'
		}
		return units[str] || error(str, 'unit')
	}

	function error(str, type) {
		throw new Error('Could not understand "' + str + '" as a ' + type)
	}
}