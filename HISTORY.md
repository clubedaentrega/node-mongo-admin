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