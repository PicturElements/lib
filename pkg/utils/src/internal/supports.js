// Vaguely Modernizr-like support lookup
const supports = {
	regex: {}
};

"dotAll|global|ignoreCase|multiline|sticky|unicode|flags|source"
	.split("|")
	.forEach(k => {
		supports.regex[k] = k in RegExp.prototype;
	});

export default supports;
