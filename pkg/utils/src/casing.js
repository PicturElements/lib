import { matchAll } from "./regex";
import { splitClean } from "./string";
import { isObject } from "./is";
import hasOwn from "./has-own";
import concatMut from "./concat-mut";

// This library assumes only ASCII A-Z letters are being
// used when differentiating between upper/lower case

const SPLITTERS = {
	camel: str => matchAll(str, /[A-Z][^A-Z\s]*|[^A-Z\s]+/g),
	snake: str => splitClean(str, /_+/g),
	constant: str => splitClean(str, /_+/g),
	pascal: str => matchAll(str, /[A-Z][^A-Z\s]*|[^A-Z\s]+/g),
	kebab: str => splitClean(str, /-+/g),
	pascalKebab: str => splitClean(str, /-+/g),
	title: str => splitClean(str, /\s+/g),
	data: str => {
		str = str.toLowerCase().replace(/^data-/, "");
		return splitClean(str, /-(?=[a-z])/g);
	},
	any: str => {
		const separatorSplit = splitClean(str, /[-_\s]+/g),
			split = [];

		for (let i = 0, l = separatorSplit.length; i < l; i++) {
			const caseChangeSplit = matchAll(separatorSplit[i], /[A-Z][^A-Z\s]+|(?:[A-Z](?![^A-Z]))+|[^A-Z\s]+/g);
			concatMut(split, caseChangeSplit);
		}

		return split;
	}
};

const JOINERS = {
	camel: split => {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += (split[i][0].toUpperCase() + split[i].substring(1).toLowerCase());

		return out;
	},
	snake: split => {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `_${split[i].toLowerCase()}`;

		return out;
	},
	constant: split => {
		let out = split[0].toUpperCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `_${split[i].toUpperCase()}`;

		return out;
	},
	pascal: split => {
		let out = "";

		for (let i = 0, l = split.length; i < l; i++)
			out += (split[i][0].toUpperCase() + split[i].substring(1).toLowerCase());

		return out;
	},
	kebab: split => {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `-${split[i].toLowerCase()}`;

		return out;
	},
	pascalKebab: split => {
		let out = "";

		for (let i = 0, l = split.length; i < l; i++) {
			if (i)
				out += "-";

			out += (split[i][0].toUpperCase() + split[i].substring(1).toLowerCase());
		}

		return out;
	},
	title: split => {
		let out = "";

		for (let i = 0, l = split.length; i < l; i++) {
			if (i)
				out += " ";

			out += (split[i][0].toUpperCase() + split[i].substring(1));
		}

		return out;
	},
	data: split => {
		let out = "data";

		for (let i = 0, l = split.length; i < l; i++)
			out += `-${split[i].toLowerCase()}`;

		return out;
	}
};

export default function casing(str) {
	resetCasingSession();
	casing.session.str = str;
	return casing;
}

casing.session = {
	str: null,
	from: null
};

casing.from = type => {
	if (!hasOwn(SPLITTERS, type)) {
		console.error(`No casing splitter for type '${type}'`);
		return casing;
	}

	casing.session.from = type;
	return casing;
};

casing.to = type => {
	if (!hasOwn(JOINERS, type)) {
		console.error(`No casing joiner for type '${type}'`);
		return "";
	}

	const str = casing.session.str,
		splitter = SPLITTERS[casing.session.from] || SPLITTERS.any,
		joiner = JOINERS[type];

	resetCasingSession();

	if (str === null) {
		console.error("Cannot convert case: no string supplied");
		return "";
	}

	return joiner(splitter(str));
};

casing.define = (type, config = {}) => {
	if (!type || typeof type != "string") {
		console.error(`Cannot define casing transform: type must be a truthy string`);
		return casing;
	}

	if (casing(type).to.camel != type) {
		console.error(`Cannot define casing transform: type must be camelCased for consistency and to enable shorthand functionality`);
		return casing;
	}

	if (hasOwn(SPLITTERS, type)) {
		console.error(`Cannot define casing transform: type '${type}' is already defined`);
		return casing;
	}

	if (!isObject(config)) {
		console.error(`Cannot define casing transform: config must be an object with at least a .split and .join method`);
		return casing;
	}

	if (typeof config.split != "function") {
		console.error(`Cannot define casing transform: splitter must be a function (as method 'split')`);
		return casing;
	}

	if (typeof config.join != "function") {
		console.error(`Cannot define casing transform: joiner must be a function (as method 'join')`);
		return casing;
	}

	SPLITTERS[type] = config.split;
	JOINERS[type] = config.join;

	Object.defineProperty(casing.from, type, {
		get:  _ => casing.from(type)
	});
	Object.defineProperty(casing.to, type, {
		get:  _ => casing.to(type)
	});

	return casing;
};

function resetCasingSession() {
	casing.session.str = null;
	casing.session.from = null;
}

(_ => {
	const splitterDescriptors = {},
		joinerDescriptors = {};

	for (const k in SPLITTERS) {
		if (!hasOwn(SPLITTERS, k))
			continue;

		splitterDescriptors[k] = {
			get: _ => casing.from(k)
		};
	}

	for (const k in JOINERS) {
		if (!hasOwn(JOINERS, k))
			continue;

		joinerDescriptors[k] = {
			get: _ => casing.to(k)
		};
	}

	Object.defineProperties(casing.from, splitterDescriptors);
	Object.defineProperties(casing.to, joinerDescriptors);
})();
