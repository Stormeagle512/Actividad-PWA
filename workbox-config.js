module.exports = {
	globDirectory: 'src/',
	globPatterns: [
		'**/*.{css,tsx,svg,ts}'
	],
	swDest: 'public/sw.js',
	ignoreURLParametersMatching: [
		/^utm_/,
		/^fbclid$/
	]
};