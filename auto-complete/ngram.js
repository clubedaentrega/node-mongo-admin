'use strict'

let N = 3

/**
 * @typedef {Array<{value: string, tf: number}>} NGramList
 * @property {number} idf
 */

/**
 * @typedef {Object<NGramList>} NGramMap
 * @property {number} maxIdf
 */

/**
 * Index the given document for future search
 * @param {Array<string>} values
 * @returns {NGramMap}
 */
module.exports.index = function (values) {
	// Map from n-gram to values
	let nGramsMap = {}
	for (let value of values) {
		let nGrams = countNGrams(value)

		for (let nGram in nGrams) {
			let arr = nGramsMap[nGram] || (nGramsMap[nGram] = [])

			arr.push({
				value,
				tf: nGrams[nGram]
			})
		}
	}

	// Calculate inverse document frequency for each n-gram
	for (let nGram in nGramsMap) {
		nGramsMap[nGram].idf = Math.log((1 + values.length) / (1 + nGramsMap[nGram].length))
	}

	nGramsMap.maxIdf = Math.log(1 + values.length)

	return nGramsMap
}

/**
 * Execute the search in the given index.
 * Return 5 most relevant results
 * @param {NGramMap} nGramsMap
 * @param {string} search
 * @param {number} [cutOff=1/2] - minimum quality
 * @returns {Array<string>}
 */
module.exports.search = function (nGramsMap, str, cutOff) {
	let nGrams = countNGrams(str),
		scoreByValue = new Map

	// The score is defined by the sum of term frequency–inverse document frequency
	// Explained here: https://en.wikipedia.org/wiki/Tf%E2%80%93idf
	// SCORE(value, text) := SUM over ngrams(text) of SCORE_NGRAM(value, ngram)
	// SCORE_NGRAM(value, ngram) := IDF(ngram) * TF(value, ngram)
	// IDF(ngram) := ln(total values / (1 + values that have ngram in it))
	// TF(value, ngram) := number of occurences of ngram in value

	// Process each ngram
	let goodMatch = 0
	for (let nGram in nGrams) {
		let list = nGramsMap[nGram],
			weight = nGrams[nGram]

		goodMatch += weight * (list ? list.idf : nGramsMap.maxIdf)

		if (!list) {
			// Ignore zero-results
			continue
		}

		for (let each of list) {
			let value = each.value,
				currentScore = scoreByValue.get(value) || 0

			scoreByValue.set(value, currentScore + weight * each.tf * list.idf)
		}
	}

	// Remove bad results, sort and slice
	cutOff = goodMatch * (cutOff || 1 / 2)
	return Array.from(scoreByValue)
		.filter(result => result[1] > cutOff)
		.sort((a, b) => b[1] - a[1])
		.map(e => e[0])
}

/**
 * Map ngrams in the string to their frequency.
 * The string is lower-cased and broken in words
 * @param {string} str
 * @returns {Object<number>}
 */
function countNGrams(str) {
	let nGrams = {},
		words = str.toLowerCase().split('.')

	for (let word of words) {
		for (let i = 0; i <= word.length - N; i++) {
			let ngram = word.substr(i, N)
			nGrams[ngram] = (nGrams[ngram] || 0) + 1
		}
	}

	return nGrams
}