import { padStart } from "@qtxr/utils";
import { isGrammarNode } from "./";

const DATE_FORMATTER_REGEX = /^([a-z]*)([A-Z]*)$/,
	DATE_FORMATTER_CLASS_MAP = {
		Y: "year",
		L: "month",
		D: "day",
		H: "hour",
		M: "minute",
		S: "second"
	};

const customGrammars = [
	{
		name: "date-formatter",
		regex: /\b([yldhms])\1+?\b/gi,
		parse({ ex, match, throwSyntaxError }) {
			const fex = DATE_FORMATTER_REGEX.exec(match);

			if (!fex)
				throwSyntaxError(`'${match}' is not a valid date formatter. A valid date formatter consists of an arbitrary number (including 0) of soft pads (lower case) and hard pads (upper case), in that order`);

			return {
				class: DATE_FORMATTER_CLASS_MAP[ex[1].toUpperCase()],
				pad: {
					soft: fex[1].length,
					hard: fex[2].length
				}
			};
		},
		resolve(meta, node) {
			return padDateFormatter(
				getDateFormatterUnitValue(meta.store.date, node.class),
				node
			);
		}
	}
];

function getDateFormatterUnitValue(dateOrValue, cls) {
	if (typeof dateOrValue == "number")
		return dateOrValue;

	if (!(dateOrValue instanceof Date))
		return 0;

	switch (cls) {
		case "year":
			return dateOrValue.getFullYear();
		case "month":
			return dateOrValue.getMonth() + 1;
		case "day":
			return dateOrValue.getDate();
		case "hour":
			return dateOrValue.getHours();
		case "minute":
			return dateOrValue.getMinutes();
		case "second":
			return dateOrValue.getSeconds();
	}

	return 0;
}

function padDateFormatter(num, formatter) {
	const pad = formatter.pad;
	num = String(num);
	num = Number(num.substr(Math.max(num.length - (pad.hard + pad.soft), 0)));
	return padStart(num, pad.hard, "0");
}

function processDateFormatter(dateOrValue, formatter, getter) {
	if (isGrammarNode(formatter, "date-formatter")) {
		let out = getDateFormatterUnitValue(dateOrValue, formatter.class);

		const outCandidate = typeof getter == "function" ?
			getter(true, out, formatter) :
			out;

		if (outCandidate !== undefined)
			out = outCandidate;

		if (typeof out == "number")
			return padDateFormatter(out, formatter);
		else if (typeof out == "string")
			return out;
		else if (isGrammarNode(out, "date-formatter"))
			return padDateFormatter(getDateFormatterUnitValue(dateOrValue, out.class), out);
	} else {
		const outCandidate = typeof getter == "function" ?
			getter(false, 0, null) :
			getter;

		if (outCandidate !== undefined)
			return outCandidate;
	}

	return formatter;
}

export default customGrammars;
export {
	processDateFormatter
};
