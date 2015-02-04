'use strict'

/* Fixed header appears when scrolling page */
window.onscroll = function () {

	var top = 0

	//FF
	if (document.documentElement.scrollTop > 0) {
		top = document.documentElement.scrollTop
	}
	//Chrome
	if (document.body.scrollTop > 0) {
		top = document.body.scrollTop
	}

	if (top >= document.getElementById('query-result').offsetTop) {
		Panel.get('fixed-table-header').style.display = 'block'
		Panel.get('fixed-table-header').style.top = top + 'px'
	} else {
		Panel.get('fixed-table-header').style.display = 'none'
	}
}