import { getWrappedRange } from "./range";
import {
	isObject,
	isTaggedTemplateArgs
} from "./is";
import serialize from "./serialize";
import repeat from "./repeat";
import {
	composeOptionsTemplates,
	createOptionsObject,
	optionize
} from "./internal/options";
import { BASE_62 } from "./internal/constants";
import hasOwn from "./has-own";

function padStart(str, length = 2, padChar = " ") {
	str = String(str);
	const pad = length - str.length;

	if (pad > 0)
		return repeat(padChar, pad) + str;

	return str;
}

function padEnd(str, length = 2, padChar = " ") {
	str = String(str);
	const pad = length - str.length;

	if (pad > 0)
		return str + repeat(padChar, pad);

	return str;
}

function spliceStr(str, from, to, replacement, relative = false) {
	const range = getWrappedRange(from, to, str.length, relative);
	replacement = replacement == null ? "" : String(replacement);
	return str.substring(0, range[0]) + replacement + str.substring(range[1]);
}

function trimStr(str, start, end) {
	start = start || 0;
	return str.substring(start, str.length - (end || 0));
}

function splitClean(str, splitter, subTrim = true) {
	if (!splitter && splitter !== "") {
		splitter = /\s+/;
		subTrim = false;
	}

	const split = str.trim().split(splitter);

	if (!subTrim)
		return split;

	const splitOut = [];

	for (let i = 0, l = split.length; i < l; i++) {
		const item = split[i].trim();

		if (item)
			splitOut.push(item);
	}

	return splitOut;
}

function uid(length = 10, alphabet = BASE_62) {
	let out = "";
	const len = alphabet.length;

	while (length--)
		out += alphabet[Math.floor(Math.random() * len)];

	return out;
}

// Fast stringification with common reasonable defaults:
// All primitives except symbols can be casted
// Non-primitives cannot be casted
// All non-castable values return null
// All castable values return a string
function castStr(value) {
	switch (typeof value) {
		case "string":
			return value;

		case "object":
			if (value === null)
				return "null";

			return null;

		case "function":
		case "symbol":
			return null;
	}

	return String(value);
}

// Possible to make as fallback ponyfill, but
// currently faster than/similar in performance compared
// to native implementation (Chromium) by using the highly
// optimized indexOf native prototype method
function startsWith(str, ref, offs = 0) {
	ref = castStr(ref);
	if (typeof str != "string" || ref === null)
		return false;

	if (!ref)
		return true;

	if (typeof offs != "number" || offs < 0)
		offs = 0;

	// Quick check: make sure at least first character matches
	if (str[offs] !== ref[0])
		return false;

	return str.indexOf(ref, offs) == offs;
}

function endsWith(str, ref, offs = 0) {
	ref = castStr(ref);
	if (typeof str != "string" || ref === null)
		return false;

	if (!ref)
		return true;

	if (typeof offs != "number" || offs < 0)
		offs = 0;

	offs = str.length - ref.length - offs;

	// Quick check: make sure at least first character matches
	if (offs < 0 || str[offs] !== ref[0])
		return false;

	return str.lastIndexOf(ref, offs) == offs;
}

// Simple static trie-based lookup
function mkStrMatcher(...sources) {
	const trie = {};

	const add = (key, value) => {
		key = castStr(key);
		if (key == null)
			return;

		let node = trie;

		for (let i = 0, l = key.length; i < l; i++) {
			const char = key[i];

			if (hasOwn(node, char))
				node = node[char];
			else {
				const newNode = {};
				node[char] = newNode;
				node = newNode;
			}
		}

		node.value = {
			key,
			value
		};
	};

	for (let i = 0, l = sources.length; i < l; i++) {
		const source = sources[i];

		if (Array.isArray(source)) {
			for (let j = 0, l2 = source.length; j < l2; j += 2)
				add(source[j], source[j + 1]);
		} else if (isObject(source)) {
			for (const k in source) {
				if (hasOwn(source, k))
					add(k, source[k]);
			}
		}
	}

	return str => {
		str = String(str);

		let node = trie,
			value = hasOwn(trie, "value") ?
				trie.value :
				null;

		for (let i = 0, l = str.length; i < l; i++) {
			if (!hasOwn(node, str[i]))
				break;

			node = node[str[i]];
			if (hasOwn(node, "value"))
				value = node.value;
		}

		return value;
	};
}

function getSerializeOptions() {
	return {
		quote: "",
		bareString: true
	};
}

const CACHED_SERIALIZE_OPTIONS = getSerializeOptions();

function compileTaggedTemplateCore(args, options) {
	if (isTaggedTemplateArgs(args)) {
		const strings = args[0];
		let out = "";

		for (let i = 0, l = strings.length; i < l; i++) {
			out += strings[i];

			if (i < l - 1)
				out += serialize(args[i + 1], options);
		}

		return out;
	}

	if (typeof args[0] == "string")
		return args[0];

	return "";
}

function compileTaggedTemplateFull(args, options) {
	const out = {
		compiled: "",
		refs: {},
		refList: [],
		refKeys: [],
		refIndices: {},
		refPositions: [],
		options
	};

	let pos = 0;

	if (!isTaggedTemplateArgs(args)) {
		if (typeof args[0] == "string")
			out.compiled = args[0];

		return out;
	}

	const strings = args[0];

	for (let i = 0, l = strings.length; i < l; i++) {
		out.compiled += strings[i];
		pos += strings[i].length;

		if (i == l - 1)
			continue;

		const refResult = typeof options.ref == "function" ?
			options.ref(args[i + 1]) :
			options.ref;

		if (refResult === true || typeof refResult == "number") {
			const key = (options.refPrefix || "ref:") +
				uid(typeof refResult == "number" ? refResult : 10) +
				(options.refSuffix || "");

			out.refs[key] = args[i + 1];
			out.refIndices[key] = i;
			out.refList.push(args[i + 1]);
			out.refKeys.push(key);
			out.refPositions.push(pos);
			out.compiled += key;
			pos += key.length;
		} else if (typeof refResult == "string") {
			if (hasOwn(out.refs, refResult))
				throw new Error(`Duplicate reference key '${refResult}'`);

			out.refs[refResult] = args[i + 1];
			out.refIndices[refResult] = i;
			out.refList.push(args[i + 1]);
			out.refKeys.push(refResult);
			out.refPositions.push(pos);
			out.compiled += refResult;
			pos += refResult.length;
		} else {
			const serialized = serialize(args[i + 1], options);
			pos += serialized.length;
			out.compiled += serialized;
		}
	}

	return out;
}

function compileTaggedTemplate(...args) {
	const options = compileTaggedTemplate.extractOptions(),
		useFull = options && (hasOwn(options, "ref") || options.full || options.meta),
		compiler = useFull ?
			compileTaggedTemplateFull :
			compileTaggedTemplateCore;

	if (options)
		return compiler(args, options);

	return compiler(args, CACHED_SERIALIZE_OPTIONS);
}

optionize(compileTaggedTemplate, getSerializeOptions, {
	ref: 15,
	full: true
});

const DISTANCE_OPS = {
	substitution: true,
	insertion: true,
	deletion: true,
	transposition: true
};

const DISTANCE_WEIGHTS = {
	substitution: 1,
	insertion: 1,
	deletion: 1,
	transposition: 1
};

const distanceOptionsTemplates = composeOptionsTemplates({
	substitution: {
		ops: {
			substitution: true
		}
	},
	insertion: {
		ops: {
			insertion: true
		}
	},
	deletion: {
		ops: {
			deletion: true
		}
	},
	transposition: {
		ops: {
			transposition: true
		}
	},
	light: {
		ops: {
			substitution: true,
			insertion: true,
			deletion: true
		}
	},
	full: {
		ops: DISTANCE_OPS
	},
	md1: {
		maxDistance: 1
	},
	md2: {
		maxDistance: 2
	},
	md3: {
		maxDistance: 3
	},
	md4: {
		maxDistance: 4
	}
});

// Damerau–Levenshtein distance, with modifications based on
// the Apache Commons Lang implementation as found here:
// https://stackoverflow.com/a/35069964
// and memory optimized through a reusable minimal matrix array
const DISTANCE_MATRIX = [];
function distance(a = "", b = "", options = {}) {
	if (a == b)
		return 0;

	options = createOptionsObject(options, distanceOptionsTemplates);

	const ops = options.ops || DISTANCE_OPS,
		weights = options.weights || DISTANCE_WEIGHTS,
		maxDistance = typeof options.maxDistance == "number" ?
			options.maxDistance :
			null;

	let al = a.length,
		bl = b.length;

	if (al < bl) {
		const tmpStr = a,
			tmpLen = al;

		a = b;
		b = tmpStr;
		al = bl;
		bl = tmpLen;
	}

	if (maxDistance && al - bl > maxDistance)
		return Infinity;

	if (!al)
		return bl || 0;
	if (!bl)
		return al || 0;

	const alphabet = {},
		sw = typeof weights.substitution == "number" ? weights.substitution : 1,
		iw = typeof weights.insertion == "number" ? weights.insertion : 1,
		dw = typeof weights.deletion == "number" ? weights.deletion : 1,
		tw = typeof weights.transposition == "number" ? weights.transposition : 1,
		mod = ops.transposition ?
			(maxDistance ?
				Math.max(Math.min(al, maxDistance), 3) :
				Math.max(al, 3)) :
			3,
		matrix = DISTANCE_MATRIX;
	let lastStart = -1,
		lastEnd = bl + 1;

	for (let i = 0; i < al; i++) {
		const ac = a[i],
			row = (i % mod) * bl,
			prevRow = ((mod + i - 1) % mod) * bl;

		let db = 0,
			jStart = 0,
			jEnd = bl,
			rowMin = Infinity;

		if (maxDistance) {
			jEnd = Math.min(i + maxDistance + 1, bl);
			jStart = Math.max(jEnd - maxDistance * 2 - 1, 0);
		}

		for (let j = jStart; j < jEnd; j++) {
			const bc = b[j];
			let min = Infinity,
				cost;

			// Substitution
			if (ops.substitution) {
				if (!i)
					cost = j;
				else if (!j)
					cost = i;
				else if (j == lastStart)
					cost = Infinity;
				else
					cost = matrix[prevRow + j - 1];

				if (ac == bc)
					cost *= sw;
				else
					cost = (cost + 1) * sw;

				if (cost < min)
					min = cost;
			}

			// Insertion
			if (ops.insertion) {
				if (!j)
					cost = (i + 1) * iw;
				else
					cost = (matrix[row + j - 1] + 1) * iw;

				if (cost < min)
					min = cost;
			}

			// Deletion
			if (ops.deletion) {
				if (!i)
					cost = (j + 1) * dw;
				else if (j >= lastEnd)
					cost = Infinity;
				else
					cost = (matrix[prevRow + j] + 1) * dw;

				if (cost < min)
					min = cost;
			}

			// Transposition
			if (ops.transposition) {
				if (ac == bc)
					db = j;
				else {
					const k = alphabet[bc] || 0,
						l = db;

					if (k < 0 || l < 0 || i - k - 1 > mod)
						cost = Infinity;
					else {
						if (!k)
							cost = l + 2;
						else if (!l)
							cost = k + 2;
						else if (maxDistance) {
							const end = Math.min(k + maxDistance, bl),
								start = Math.max(end - maxDistance * 2 - 1, 0);

							if (l < start + 1 || l >= end)
								cost = Infinity;
							else
								cost = matrix[((k - 1) % mod) * bl + (l - 1)];
						} else
							cost = matrix[((k - 1) % mod) * bl + (l - 1)];

						cost = (cost + ((i - k - 1) + 1 + (j - l - 1))) * tw;
					}

					if (cost < min)
						min = cost;
				}
			}

			if (maxDistance && min < rowMin)
				rowMin = min;

			matrix[row + j] = min;
		}

		// rowMin gives a lower bound for the distance after each
		// Operation. At best, it catches an out of bounds distance,
		// and at worst it lets the algorithm run slightly longer
		if (maxDistance && rowMin > maxDistance)
			return Infinity;

		if (ops.transposition)
			alphabet[ac] = i;

		lastStart = jStart;
		lastEnd = jEnd;
	}

	const dist = matrix[((al - 1) % mod + 1) * bl - 1];

	if (maxDistance && dist > maxDistance)
		return Infinity;

	return dist;
}

// Adapted from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint#Polyfill
const fromCodePoint = String.fromCodePoint ?
	String.fromCodePoint.bind(String) :
	(...points) => {
		const units = [];
		let out = "";

		for (let i = 0, l = points.length; i < l; i++) {
			let point = Number(points[i]);

			if (point >= 0x10ffff || point >>> 0 != point)
				throw RangeError("Invalid code point: " + point);

			if (point < 0xffff)
				units.push(point);
			else {
				point -= 0x10000;
				units.push(
					(point >> 10) + 0xd800,
					(point % 0x400) + 0xdc00
				);
			}

			if (units.length >= 0x3fff) {
				out += String.fromCharCode(...units);
				units.length = 0;
			}
		}

		return out + String.fromCharCode(...units);
	};

const codePointAt = String.prototype.codePointAt ?
	(str, idx) => String(str).codePointAt(idx) :
	(str, idx = 0) => {
		str = String(str);

		if (idx < 0 || idx >= str.length)
			return NaN;

		const high = str.charCodeAt(idx);
		if (high >= 0xd800 && high <= 0xdbff && idx < str.length - 1) {
			const low = str.charCodeAt(idx + 1);

			if (low >= 0xdc00 && low <= 0xdfff)
				return ((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
		}

		return high;
	};

export {
	repeat,
	padStart,
	padEnd,
	spliceStr,
	trimStr,
	splitClean,
	uid,
	castStr,
	startsWith,
	endsWith,
	mkStrMatcher,
	compileTaggedTemplate,
	distance,
	fromCodePoint,
	codePointAt
};
