/**
 * @file Control a context menu
 */
'use strict'

var Menu = (function () {
	/**
	 * Menu constructor
	 * @class
	 * @private
	 * @param {Object} map
	 */
	function Menu(map) {
		/** @member {HTMLElement} */
		this.el = createEl('div.menu')

		document.body.appendChild(this.el)

		/** @member {Array<Item|SubMenu>} */
		this.items = Object.keys(map).map(function (label) {
			if (typeof map[label] === 'function') {
				return new Item(label, map[label], this)
			} else {
				return new SubMenu(label, map[label], this)
			}
		}, this)

		this.items.forEach(function (item) {
			this.el.appendChild(item.el)
		}, this)

		/** @member {DOMRect} */
		this.rect = this.el.getBoundingClientRect()

		/** @member {?SubMenu} */
		this.openedSubMenu = null

		/** @member {boolean} */
		this.empty = this.items.length === 0
	}

	/**
	 * @param {Number} x
	 * @param {Number} y
	 * @private
	 */
	Menu.prototype.setPosition = function (x, y) {
		if (x + this.rect.width > window.innerWidth) {
			x = window.innerWidth - this.rect.width
		}
		if (y + this.rect.height > window.innerHeight) {
			y = window.innerHeight - this.rect.height
		}

		this.el.style.left = x + 'px'
		this.el.style.top = y + 'px'

		this.items.forEach(function (item) {
			if (item instanceof SubMenu) {
				item.updatePosition()
			}
		})
	}

	/**
	 * @private
	 */
	Menu.prototype.close = function () {
		this.el.style.display = 'none'
		this.closeSubMenu()
	}

	/**
	 * @private
	 */
	Menu.prototype.open = function () {
		this.el.style.display = ''
	}

	/**
	 * @private
	 */
	Menu.prototype.closeSubMenu = function () {
		if (this.openedSubMenu) {
			this.openedSubMenu.close()
			this.openedSubMenu = null
		}
	}

	/**
	 * @param {SubMenu} submenu
	 * @private
	 */
	Menu.prototype.openSubMenu = function (submenu) {
		this.closeSubMenu()
		this.openedSubMenu = submenu
		this.openedSubMenu.open()
	}

	/**
	 * Remove the menu completely
	 * @private
	 */
	Menu.prototype.destroy = function () {
		document.body.removeChild(this.el)
		this.el = null

		this.items.forEach(function (item) {
			item.destroy()
		})
	}

	/**
	 * Menu item constructor
	 * @class
	 * @private
	 * @param {string} label
	 * @param {Function} callback
	 * @param {Menu} parent
	 */
	function Item(label, callback, parent) {
		var that = this

		/** @member {HTMLElement} */
		this.el = createEl('div.menu-item', label)

		this.el.onclick = function () {
			callback()
		}

		/** @member {Menu} */
		this.parent = parent

		this.el.onmouseenter = function () {
			that.parent.closeSubMenu()
		}
	}

	/**
	 * @private
	 */
	Item.prototype.destroy = function () {
		this.parent = null
	}

	/**
	 * @class
	 * @private
	 * @param {string} label
	 * @param {Object} map
	 * @param {Menu} parent
	 */
	function SubMenu(label, map, parent) {
		var that = this

		/** @member {Menu} */
		this.menu = new Menu(map)

		/** @member {Menu} */
		this.parent = parent

		/** @member {HTMLElement} */
		this.el = createEl('div.menu-submenu', label)

		if (this.menu.empty) {
			this.el.classList.add('menu-item-disabled')
		} else {
			this.el.onmouseenter = function () {
				that.parent.openSubMenu(that)
			}
		}
	}

	/**
	 * @private
	 */
	SubMenu.prototype.updatePosition = function () {
		var rect = this.el.getBoundingClientRect()

		this.menu.setPosition(rect.right, rect.top)
		this.menu.close()
	}

	/**
	 * @private
	 */
	SubMenu.prototype.open = function () {
		this.menu.open()
		this.el.classList.add('menu-submenu-active')
	}

	/**
	 * @private
	 */
	SubMenu.prototype.close = function () {
		this.menu.close()
		this.el.classList.remove('menu-submenu-active')
	}

	/**
	 * @private
	 */
	SubMenu.prototype.destroy = function () {
		this.parent = null
		this.menu.destroy()
	}

	/**
	 * @param {string} tag
	 * @param {string} [content]
	 * @returns {HTMLElement}
	 * @private
	 */
	function createEl(tag, content) {
		var parts = tag.split('.'),
			el = document.createElement(parts[0])
		el.classList.add.apply(el.classList, parts.slice(1))
		el.textContent = content || ''
		return el
	}

	/** @var {?Function} */
	var destroyCurrent = null

	return {
		/**
		 * Show a given menu under a MouseEvent
		 * Example:
		 *
		 * Menu.show({
		 *     'Remove': removeFn,
		 *     'Share': {
		 *         'Facebook': faceFn,
		 *         'Twitter': twitterFn
		 *     }
		 * })
		 * @param {MouseEvent} event
		 * @param {Object} map
		 */
		show: function (event, map) {
			var menu = new Menu(map)

			if (destroyCurrent) {
				destroyCurrent()
			}

			if (menu.empty) {
				// Don't show empty menus
				menu.destroy()
				return
			}

			menu.setPosition(event.clientX, event.clientY)

			destroyCurrent = function () {
				menu.destroy()
				document.body.removeEventListener('click', destroyCurrent)
				destroyCurrent = null
			}

			document.body.addEventListener('click', destroyCurrent)
		}
	}
})()