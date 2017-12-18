/**
 * @file Explore window
 */

/*globals Panel, json, Storage*/
'use strict'

/**
 * Open the explore window to show the given value
 * @function
 * @param {*} [value] if not sent, show a loading message
 */
let explore = (function () {
	let asJSON = false,
		el, content, value, button

	// Get DOM elements
	addEventListener('load', function () {
		el = Panel.get('explore-window')
		content = Panel.get('explore-json')
		el.onclick = function (event) {
			if (event.target === el) {
				hide()
			}
		}
		button = Panel.get('explore-show')
		button.onclick = function () {
			asJSON = !asJSON
			show()
		}
	})
	addEventListener('keyup', function (event) {
		if (event.keyCode === 27 && !event.ctrlKey && !event.shiftKey && !event.altKey) {
			hide()
		}
	})

	function show() {
		let localDate = Boolean(Storage.get('localDate')),
			oidTimestamp = Boolean(Storage.get('oidTimestamp')),
			hexBinary = Boolean(Storage.get('hexBinary'))

		el.style.display = ''
		button.value = asJSON ? 'Pretty display' : 'Show as JSON'
		if (asJSON) {
			content.textContent = JSON.stringify(value, null, '  ')
		} else {
			content.innerHTML = json.stringify(value, true, true, localDate, hexBinary, oidTimestamp)
		}
	}

	function hide() {
		el.style.display = 'none'
		value = null
	}

	return function (v) {
		value = v
		asJSON = false
		show()
	}
})()