import { getWrappedRange } from "./range";
import { isTaggedTemplateArgs } from "./is";
import serialize from "./serialize";
import repeat from "./repeat";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

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
	return str.substr(0, range[0]) + replacement + str.substr(range[1]);
}

function trimStr(str, start, end) {
	start = start || 0;
	return str.substr(start, str.length - (end || 0) - start);
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

function getSerializeOptions() {
	return {
		quote: "",
		bareString: true
	};
}

const CACHED_SERIALIZE_OPTIONS = getSerializeOptions();

function compileTaggedTemplateCore(args, options) {
	if (isTaggedTemplateArgs(args)) {
		const raw = args[0].raw ;
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

function compileTaggedTemplate(...args) {
	const options = compileTaggedTemplate.options;
	compileTaggedTemplate.options = null;

	if (options)
		return compileTaggedTemplateCore(args, options);
	
	return compileTaggedTemplateCore(args, CACHED_SERIALIZE_OPTIONS);
}

compileTaggedTemplate.options = null;
compileTaggedTemplate.with = options => {
	if (compileTaggedTemplate.options)
		compileTaggedTemplate.options = Object.assign(compileTaggedTemplate.options, options);
	else
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

// Damerau–Levenshtein distance, with modifications based by
// Apache Commons Lang implementation as found here:
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

export {
	repeat,
	padStart,
	padEnd,
	spliceStr,
	trimStr,
	splitClean,
	compileTaggedTemplate,
	distance
};
