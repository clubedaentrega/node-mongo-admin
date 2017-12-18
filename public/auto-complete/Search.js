'use strict'

let Search = {
	COST_ADD_BEFORE: 1e-2,
	COST_ADD: 0.1,
	COST_ADD_AFTER: 1e-4,
	COST_DELETE: 1,
	COST_CHANGE: 1
}

/**
 * @typedef {Object} Search~Result
 * @property {string} plain
 * @property {Array<string>} highlight - plain split into substrings. Odd indexes are highlights
 */

/**
 * Search a given of texts for good matches using a modified version of
 * Levenshtein distance. The match is case-insensitive and the cost of adding
 * characters is defined as:
 * 0.1 to add to the beginning of query, 0.01 to add to end of query, 1 otherwise
 * @param {Array<string>} texts
 * @param {string} query
 * @param {number} [maxResults=7]
 * @param {number} [minQuality=0.8]
 * @returns {Array<Search~Result>}
 */
Search.search = function (texts, query, maxResults = 7, minQuality = 0.8) {
	// Sort texts to reuse prefix more efficiently
	texts = texts.slice().sort()

	// Get max text length
	let maxText = 0
	for (let text of texts) {
		maxText = Math.max(maxText, text.length)
	}

	// Prepare internal memory (n + 1) * (m + 1)
	// mem[i][j] means the minimum cost to go from
	// query.slice(0, i) to text.slice(0, j). Therefore,
	// distance(query, text) = mem[query.length][text.length]
	// mem[0][j] = ADD_BEFORE * j
	// mem[i][0] = REMOVE * i
	let mem = [],
		// Keep track of delete, add, change costs
		// Used to highlight matches
		memDelete = [],
		memAdd = [],
		memChange = []
	for (let i = 0; i <= query.length; i++) {
		mem.push(new Array(maxText + 1).fill(0))
		memDelete.push(new Array(maxText + 1).fill(0))
		memAdd.push(new Array(maxText + 1).fill(0))
		memChange.push(new Array(maxText + 1).fill(0))
		mem[i][0] = Search.COST_DELETE * i
		memDelete[i][0] = Search.COST_DELETE * i
	}
	for (let j = 0; j <= maxText; j++) {
		mem[0][j] = Search.COST_ADD_BEFORE * j
		memAdd[0][j] = Search.COST_ADD_BEFORE * j
	}

	// Eval distances
	let results = [],
		lastText = '',
		queryLower = query.toLowerCase(),
		COST_DELETE = Search.COST_DELETE,
		COST_ADD = Search.COST_ADD,
		COST_ADD_AFTER = Search.COST_ADD_AFTER,
		COST_CHANGE = Search.COST_CHANGE
	for (let text of texts) {
		let dist = getDistance(text),
			quality = 1 - (dist / Math.max(query.length, text.length))
		if (quality >= minQuality) {
			results.push({
				text,
				dist
			})
		}
	}

	// Sort results by distance ASC, then text ASC
	results.sort((a, b) => (a.dist - b.dist) ||
		(a.text > b.text ? 1 : (a.text === b.text ? 0 : -1)))

	lastText = ''
	return results.slice(0, maxResults).map(each => {
		return {
			plain: each.text,
			highlight: getHighlight(each.text)
		}
	})

	/**
	 * @param {string} text
	 * @param {boolean} [keepCosts=false] - if true also fill memDelete, memAdd, memChange
	 * @returns {number}
	 */
	function getDistance(text, keepCosts = false) {
		// Find shared prefix (k -> first non-matching index)
		let k
		for (k = 0; k < text.length && k < lastText.length; k++) {
			if (text[k] !== lastText[k]) {
				break
			}
		}

		// Apply Levenshtein algorithm
		let textLower = text.toLowerCase()
		for (let i = 1; i <= query.length; i++) {
			let lastI = i === query.length,
				queryC = queryLower[i - 1]
			for (let j = k + 1; j <= text.length; j++) {
				let costDelete = mem[i - 1][j] + COST_DELETE,
					costAdd = mem[i][j - 1] + (lastI ? COST_ADD_AFTER : COST_ADD),
					costChange = mem[i - 1][j - 1] + (queryC === textLower[j - 1] ? 0 : COST_CHANGE)
				mem[i][j] = Math.min(costDelete, costAdd, costChange)
				if (keepCosts) {
					memDelete[i][j] = costDelete
					memAdd[i][j] = costAdd
					memChange[i][j] = costChange
				}
			}
		}

		lastText = text
		return mem[query.length][text.length]
	}

	/**
	 * @param {string} text
	 * @returns {Array<string>}
	 */
	function getHighlight(text) {
		// Fill mem, memDelete, memAdd, memChange matrix
		getDistance(text, true)

		// Follow the algorithm backwards, starting at the end, up to (0, 0)
		// At each intermediate step (i, j) the cost may be due to removing,
		// adding, changing the current character or some combination of those.
		// We want to highlight the step in which the current char was replaced
		// with itself. From the potentially multiple decision paths, we'll keep
		// the one with most highlights
		let bestHighs = []
		recurse(query.length, text.length, [])

		// Convert to string slices
		let highlight = [''],
			wasHigh = false
		for (let j = 0; j < text.length; j++) {
			let isHigh = bestHighs.includes(j)
			if (isHigh !== wasHigh) {
				highlight.push('')
				wasHigh = isHigh
			}
			highlight[highlight.length - 1] += text[j]
		}

		return highlight

		function recurse(i, j, highs) {
			if (!i && !j) {
				// Finished: path reached (0, 0)
				if (highs.length > bestHighs.length) {
					bestHighs = highs.slice()
				}

				return
			}

			let m = mem[i][j],
				maxNewHighs = Math.min(i, j)
			if (highs.length + maxNewHighs <= bestHighs.length) {
				// Upper bound is lower than current result
				return
			}
			if (i && m === memDelete[i][j]) {
				recurse(i - 1, j, highs)
			}
			if (j && m === memAdd[i][j]) {
				recurse(i, j - 1, highs)
			}
			if (i && j && m === memChange[i][j]) {
				let same = m === mem[i - 1][j - 1]
				if (same) {
					highs.push(j - 1)
				}
				recurse(i - 1, j - 1, highs)
				if (same) {
					highs.pop()
				}
			}
		}
	}
}