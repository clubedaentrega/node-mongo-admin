'use strict'

let sample = require('./sample'),
	parse = require('./parse'),
	suggest = require('./suggest'),
	schema

if (process.argv.length < 4) {
	console.log('Usage: node sample <connection> <collection>')
	process.exit()
}

let raw = '',
	cursor = 0

process.stdin.setRawMode(true)
process.stdout.write(('\n').repeat(process.stdout.rows))
display('')

process.stdin.on('data', data => {
	let str = data.toString()

	if (str === '\x03' || str === '\x04') {
		// Ctrl+C or Ctrl+D
		process.exit()
	} else if (str === '\x08') {
		// Backspace
		if (cursor > 0) {
			raw = raw.slice(0, cursor - 1) + raw.slice(cursor)
			cursor -= 1
		}
	} else if (str === '\x1b[3~') {
		// Delete
		raw = raw.slice(0, cursor) + raw.slice(cursor + 1)
	} else if (str === '\x1b[C') {
		// Right
		if (cursor < str.length) {
			cursor += 1
		}
	} else if (str === '\x1b[D') {
		// Left
		if (cursor > 0) {
			cursor -= 1
		}
	} else if (str === '\x0d') {
		// Enter
		raw = ''
		cursor = 0
	} else if (str >= '\x20') {
		// Text
		raw = raw.slice(0, cursor) + str + raw.slice(cursor)
		cursor += 1
	}

	display(getSuggestions())
})

/**
 * Display the given value in the screen
 * @param {string} str
 */
function display(str) {
	process.stdout.write('\x1b[H\x1b[J')
	process.stdout.write('Find: ' + raw)
	process.stdout.write('\x1b[' + (raw.length - cursor) + 'D')
	process.stdout.write('\x1b[s')
	process.stdout.write('\n\n')

	process.stdout.write(str)

	process.stdout.write('\x1b[u')
}

require('../dbs')((err, dbs) => {
	if (err) {
		throw err
	}

	let db = dbs[process.argv[2]]

	if (!db) {
		throw new Error('Invalid db')
	}

	display('Sampling collection...')
	sample(db.collection(process.argv[3]), (err, schema_) => {
		if (err) {
			throw err
		}

		schema = schema_
		display('Ready to show suggestions')
	})
})

/**
 * @return {string}
 */
function getSuggestions() {
	return JSON.stringify(parse(raw, cursor), null, '\t')
}