# Node Mongo Admin

A simple web application to visualize mongo data inspired by PHPMyAdmin

## Install
1. Clone [the repo](https://github.com/clubedaentrega/node-mongo-admin)
2. Copy the file `example-config.js` to `config.js` and edit what you want
3. Start with `node index` or, if you have `pm2`, `npm start`

## Features
* Multiple connections
* Multiple users and permissions
* Table-like display
* HTTPs and BasicAuth
* Relaxed query language (accepts not only JSON, but also plain JS)
* Right click to quick search (even between databases)
* Support for distinct and aggregate query
* Export to HTML
* API to prompt users for one or many ids (see bellow)

## Example
![screen shot](https://raw.githubusercontent.com/clubedaentrega/node-mongo-admin/master/ss.png)

## Credits
Icons by [FamFamFam](http://www.famfamfam.com/lab/icons/silk/)

## Prompt API
Another window can open a node-mongo-admin's window to prompt the user for one or many ids.

Example:
```js
var promptWindow = window.open(baseUrl + '?promptOne')
window.onmessage = function (event) {
	if (event.source === promptWindow) {
		console.log(event.data)
	}
}
```

Use browser APIs (like `window.open()` or `<iframe>`) to render frame with the interface. Append `'?promptOne'` or `'?promptMany'` to the end of the URL to activate prompt mode. In this mode, the user can only make simple queries and have access to the "Return selected" button.

When the user clicks that button, the child window will emit a message to the opener window with `data` in the following format:
```json
{
	"type": "return-selected",
	"connection": "connection name",
	"collection": "collection name",
	"ids": ["id1", "id2", "id3"]
}
```

Note that `ids` is an array, even in the `promptOne` mode. In this case, it'll have only one element.

You can also provide initial values for the connection and collection fields in the URL with: `?promptOne&connection-name&collection-name`