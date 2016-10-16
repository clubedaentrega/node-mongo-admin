'use strict'

let NGram = {
	n: 3
}

/**
 * @typedef {Object} NGram~Value
 * @property {Array<string>} terms
 */

/**
 * @typedef {Array<{value: NGram~Value, tf: number}>} NGram~List
 * @property {number} idf
 */

/**
 * @typedef {Object<NGram~List>} NGram~Map
 * @property {number} maxIdf
 */

/**
 * Index the given document for future search
 * @param {Array<Value>} values
 * @returns {NGram~Map}
 */
NGram.index = function (values) {
	// Map from n-gram to values
	let nGramsMap = {}
	for (let value of values) {
		let nGrams = NGram._count(value.terms)

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
 * @param {NGram~Map} nGramsMap
 * @param {Array<string>} terms
 * @param {number} [cutOff=1/2] - minimum quality
 * @returns {Array<{score: number, value: NGram~Value}>}
 */
NGram.search = function (nGramsMap, terms, cutOff) {
	let nGrams = NGram._count(terms),
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
		.map(e => ({
			value: e[0],
			score: e[1]
		}))
}

/**
 * Map ngrams in the strings to their frequency.
 * @param {Array<string>} terms
 * @returns {Object<number>}
 * @private
 */
NGram._count = function (terms) {
	let nGrams = {}

	for (let term of terms) {
		for (let i = 0; i <= term.length - NGram.n; i++) {
			let ngram = term.substr(i, NGram.n)
			nGrams[ngram] = (nGrams[ngram] || 0) + 1
		}
	}

	return nGrams
}