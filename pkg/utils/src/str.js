import { getWrappedRange } from "./range";
import {
	isObject,
	isTaggedTemplateArgs
} from "./is";
import serialize from "./serialize";
import repeat from "./repeat";
import {
	composeOptionsTemplates,
	createOptionsObject
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

function getSerializeOptions() {
	return {
		quote: "",
		bareString: true
	};
}

const CACHED_SERIALIZE_OPTIONS = getSerializeOptions();

function compileTaggedTemplateCore(args, options) {
	if (isTaggedTemplateArgs(args)) {
		const raw = args[0].raw;
		let out = "";

		for (let i = 0, l = raw.length; i < l; i++) {
			out += raw[i];

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
		refKeys: [],
		options
	};

	if (isTaggedTemplateArgs(args)) {
		const raw = args[0].raw;

		for (let i = 0, l = raw.length; i < l; i++) {
			out.compiled += raw[i];

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
				out.refKeys.push(key);
				out.compiled += key;
			} else if (typeof refResult == "string") {
				if (hasOwn(out.refs, refResult))
					throw new Error(`Duplicate reference key '${refResult}'`);

				out.refs[refResult] = args[i + 1];
				out.refKeys.push(refResult);
				out.compiled += refResult;
			} else
				out.compiled += serialize(args[i + 1], options);
		}

		return out;
	}
	
	if (typeof args[0] == "string")
		out.compiled = args[0];

	return out;
}

function compileTaggedTemplate(...args) {
	const options = compileTaggedTemplate.options;
	compileTaggedTemplate.options = null;

	const useFull = options && (hasOwn(options, "ref") || options.full || options.meta),
		compiler = useFull ?
			compileTaggedTemplateFull :
			compileTaggedTemplateCore;

	if (options)
		return compiler(args, options);
	
	return compiler(args, CACHED_SERIALIZE_OPTIONS);
}

compileTaggedTemplate.options = null;
compileTaggedTemplate.with = (options, override = true) => {
	if (!isObject(options))
		return compileTaggedTemplate;

	if (compileTaggedTemplate.options) {
		if (override)
			compileTaggedTemplate.options = Object.assign(compileTaggedTemplate.options, options);
		else
			compileTaggedTemplate.options = Object.assign({}, options, compileTaggedTemplate.options);
	} else
		compileTaggedTemplate.options = Object.assign(getSerializeOptions(), options);

	return compileTaggedTemplate;
};

const ALL_OPS = {
	substitution: true,
	insertion: true,
	deletion: true,
	transposition: true
};

const WEIGHTS = {
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
		ops: ALL_OPS
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
function distance(a = "", b = "", options = {}) {
	if (a == b)
		return 0;

	options = createOptionsObject(options, distanceOptionsTemplates);

	const ops = options.ops || ALL_OPS,
		weights = options.weights || WEIGHTS,
		maxDistance = typeof options.maxDistance == "number" ?
			options.maxDistance :
			null;

	let al = a.length,
		bl = b.length;

	if (al < bl) {
		let tmpStr = a,
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
		matrix = Array(al * bl),
		sw = typeof weights.substitution == "number" ? weights.substitution : 1,
		iw = typeof weights.insertion == "number" ? weights.insertion : 1,
		dw = typeof weights.deletion == "number" ? weights.deletion : 1,
		tw = typeof weights.transposition == "number" ? weights.transposition : 1;

	for (let i = 0; i < al; i++) {
		const ac = a[i];
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
				else
					cost = nullish(matrix[(i - 1) * bl + (j - 1)]);
				cost += Number(ac != bc);

				if (cost * sw < min)
					min = cost * sw;
			}

			// Insertion
			if (ops.insertion) {
				if (!j)
					cost = i + 1;
				else
					cost = nullish(matrix[i * bl + (j - 1)]) + 1;

				if (cost * iw < min)
					min = cost * iw;
			}
			
			// Deletion
			if (ops.deletion) {
				if (!i)
					cost = j + 1;
				else
					cost = nullish(matrix[(i - 1) * bl + j]) + 1;

				if (cost * dw < min)
					min = cost * dw;
			}

			// Transposition
			if (ops.transposition) {
				if (ac == bc)
					db = j;
				else {
					const k = alphabet[bc] || 0,
						l = db;

					if (k < 0 || l < 0)
						cost = Infinity;
					else {
						if (!k)
							cost = l + 2;
						else if (!l)
							cost = k + 2;
						else
							cost = nullish(matrix[(k - 1) * bl + (l - 1)]);

						cost += ((i - k - 1) + 1 + (j - l - 1));
					}

					if (cost * tw < min)
						min = cost * tw;
				}
			}

			if (maxDistance && min < rowMin)
				rowMin = min;

			matrix[i * bl + j] = min;
		}

		// rowMin gives a lower bound for the distance after each
		// Operation. At best, it catches an out of bounds distance,
		// and at worst it lets the algorithm run slightly longer
		if (maxDistance && rowMin > maxDistance)
			return Infinity;
		
		if (ops.transposition)
			alphabet[ac] = i;
	}

	if (maxDistance && matrix[matrix.length - 1] > maxDistance)
		return Infinity;

	return matrix[matrix.length - 1];
}

function nullish(candidate) {
	if (candidate == null)
		return Infinity;

	return candidate;
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
	compileTaggedTemplate,
	distance,
	fromCodePoint,
	codePointAt
};
