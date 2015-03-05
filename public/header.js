'use strict'

/* Sticky header appears when scrolling page */
window.onscroll = function () {

	var top = window.pageYOffset

	if (top >= document.getElementById('query-result').offsetTop) {
		Panel.get('sticky-table-header').style.display = 'block'
		Panel.get('sticky-table-header').style.top = top + 'px'
	} else {
		Panel.get('sticky-table-header').style.display = 'none'
	}
}