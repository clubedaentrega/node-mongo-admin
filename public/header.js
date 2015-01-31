'use strict'

/* Fixed header appears when scrolling page */
window.onscroll = function () {
	if (document.body.scrollTop >= document.getElementById('query-result').offsetTop) {
		document.getElementById('fixed-table-header').style.display = 'block'
		document.getElementById('fixed-table-header').style.top = document.body.scrollTop + 'px'
	} else {
		document.getElementById('fixed-table-header').style.display = 'none'
	}
}