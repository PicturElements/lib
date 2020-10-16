// Vaguely Modernizr-like support lookup
const supports = {
	stats: {
		total: 0,
		passing: 0,
		failing: 0,
		coverage: 0
	}
};

function set(accessor, value) {
	const path = typeof accessor == "string" ?
			accessor.split(".") :
			accessor,
		stats = supports.stats;
	let target = supports;

	for (let i = 0, l = path.length; i < l - 1; i++)
		target = target[path[i]] = target[path[i]] || {};

	target[path.pop()] = value;

	if (value)
		stats.passing++;
	else
		stats.failing++;

	stats.total++;
	stats.coverage = stats.passing / stats.total;
}

"dotAll|global|ignoreCase|multiline|sticky|unicode|flags|source"
	.split("|")
	.forEach(k => set(["regex", k], k in RegExp.prototype));

[
	// Keywords
	["keywords.of", "for(var o of []);"],
	["keywords.let", "let a"],
	["keywords.const", "const a=1"],
	["keywords.class", "class T{}"],
	["keywords.async", "async function f(){}"],
	// Operators
	["operators.optionalChaining", "var o={};o?.p"],
	["operators.nullishCoalescing", "0??1"],
	["operators.exponentiation", "1**1"],
	["operators.logicalAssignment", "var a;a&&=0"],
	["operators.pipeline", "function f(){};0|>f"],
	// Numericals
	["numerical.binary", "0b0"],
	["numerical.octal", "0o0"],
	["numerical.separator", "1_0"],
	// Types
	["types.bigint", "1n"],
	["types.promise", "Promise()"],
	// Expressions
	["expressions.destructuring", "var o={p:0},{p}=o"],
	["expressions.spread", "[...[]]"],
	["expressions.generator", "function*f(){}"],
	["expressions.arrowFunction", "_=>_"],
	// Constructs
	["constructs.templateString", "``"],
	["constructs.unicodeEscape", "'\\u{a}'=='\\n'"],
	["constructs.objectShorthand", "var a,o={a}"],
	["constructs.objectMethod", "var o={m(){}}"],
	["constructs.defaultParameter", "function f(a=0){}"],
	// Features
	["features.nullProto", "Object.create(null)"]
]
	.forEach(([accessor, code]) => {
		try {
			Function(code);
			set(accessor, true);
		} catch {
			set(accessor, false);
		}
	});

export default supports;
