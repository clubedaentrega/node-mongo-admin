# 3.1.0
* Fixed: context menu sometimes not showing
* Added: support for mongodb 3.2 new aggregation stages

# 3.0.0

## Breaking changes
* Changed: use `PM2` instead of `forever` in `npm start`
* Changed: dropped support for node v0.10

## Non-breaking changes
* Added: option to display object ids as timestamps
* Added: plot data (beta) (supported chart types: area, bar, column, line, histogram)
* Fixed: [#19](https://github.com/clubedaentrega/node-mongo-admin/issues/19)
* Fixed: remove some clutter from the UI

# 2.1.1
* Fixed: `json.preParse`

# 2.1.0
* Added: support for GeoJSON
* Added: support for count queries
* Changed: custom input elements

# 2.0.0
* Added: support for multiple users in basic http auth
* Added: allow a users to use only some connections

## Breaking changes
`basicAuth` field in config is now an array. If you're using basic auth, change from:

```js
basicAuth: {
	user: 'x',
	password: 'pass'
}
```

to

```js
basicAuth: [{
	user: 'x',
	password: 'pass'
}]
```