import { getWrappedRange } from "./range";
import { isTaggedTemplateArgs } from "./is";
import serialize from "./serialize";
import repeat from "./repeat";

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

export {
	repeat,
	padStart,
	padEnd,
	spliceStr,
	trimStr,
	splitClean,
	compileTaggedTemplate
};
