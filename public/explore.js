/**
 * @file Explore window
 */
/*globals Panel, json*/
'use strict'

/**
 * Open the explore window to show the given value
 * @function
 * @param {*} [value] if not sent, show a loading message
 */
var explore = (function () {
	var el, content, value, button, asJSON = false

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
		el.style.display = ''
		button.value = asJSON ? 'Pretty display' : 'Show as JSON'
		if (asJSON) {
			content.textContent = JSON.stringify(value, null, '  ')
		} else {
			content.innerHTML = json.stringify(value, true, true)
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