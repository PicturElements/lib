import { matchAll } from "./regex";
import { splitClean } from "./str";
import concatMut from "./concat-mut";

// This library assumes only ASCII A-Z letters are being
// used when differentiating between upper/lower case

const splitters = {
	camel: str => matchAll(str, /[A-Z][^A-Z\s]*|[^A-Z\s]+/g),
	snake: str => splitClean(str, /_+/g),
	constant: str => splitClean(str, /_+/g),
	pascal: str => matchAll(str, /[A-Z][^A-Z\s]*|[^A-Z\s]+/g),
	kebab: str => splitClean(str, /-+/g),
	pascalKebab: str => splitClean(str, /-+/g),
	title: str => splitClean(str, /\s+/g),
	data(str) {
		str = str.toLowerCase().replace(/^data-/, "");
		return splitClean(str, /-(?=[a-z])/g);
	},
	any(str) {
		const separatorSplit = splitClean(str, /[-_\s]+/g),
			split = [];

		for (let i = 0, l = separatorSplit.length; i < l; i++) {
			const caseChangeSplit = matchAll(separatorSplit[i], /[A-Z][^A-Z\s]*|[^A-Z\s]+/g);
			concatMut(split, caseChangeSplit);
		}

		return split;
	}
};

const joiners = {
	camel(split) {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += (split[i][0].toUpperCase() + split[i].substr(1).toLowerCase());

		return out;
	},
	snake(split) {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `_${split[i].toLowerCase()}`;

		return out;
	},
	constant(split) {
		let out = split[0].toUpperCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `_${split[i].toUpperCase()}`;

		return out;
	},
	pascal(split) {
		let out = "";

		for (let i = 0, l = split.length; i < l; i++)
			out += (split[i][0].toUpperCase() + split[i].substr(1).toLowerCase());

		return out;
	},
	kebab(split) {
		let out = split[0].toLowerCase();

		for (let i = 1, l = split.length; i < l; i++)
			out += `-${split[i].toLowerCase()}`;

		return out;
	},
	pascalKebab(split) {
		let out = "";
		
		for (let i = 0, l = split.length; i < l; i++) {
			if (i)
				out += "-";

			out += (split[i][0].toUpperCase() + split[i].substr(1).toLowerCase());
		}

		return out;
	},
	title(split) {
		let out = "";
		
		for (let i = 0, l = split.length; i < l; i++) {
			if (i)
				out += " ";

			out += (split[i][0].toUpperCase() + split[i].substr(1));
		}

		return out;
	},
	data(split) {
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
	if (!splitters.hasOwnProperty(type)) {
		console.error(`No casing splitter for type '${type}'`);
		return casing;
	}

	casing.session.from = type;
	return casing;
};

casing.to = type => {
	if (!joiners.hasOwnProperty(type)) {
		console.error(`No casing joiner for type '${type}'`);
		return "";
	}

	const str = casing.session.str,
		splitter = splitters[casing.session.from] || splitters.any,
		joiner = joiners[type];
	
	resetCasingSession();

	if (str === null) {
		console.error("Cannot convert case: no string supplied");
		return "";
	}

	return joiner(splitter(str));
};

function resetCasingSession() {
	casing.session.str = null;
	casing.session.from = null;
}
