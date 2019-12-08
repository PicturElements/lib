import {
	createOptionsObject,
	composeOptionsTemplates
} from "./options";
import { escape } from "./str";
import { cleanRegex } from "./regex";

const globRegex = /\\([^\\\/])|(\?|\*\*|\*)|\[(!)?([^\\\/]*?)\]|([$^()\[\]\/\\{}.*+?|])/g,
	globCache = {},
	boundaryCache = {};

function compileGlob(glob, options) {
	if (typeof glob != "string")
		return null;

	options = createOptionsObject(options, optionsTemplates);

	const matchStart = !options.noMatchStart && !options.noMatchFull,
		matchEnd = !options.noMatchEnd && !options.noMatchFull,
		boundaryPrecursor = typeof options.boundary == "string" ? options.boundary : "\\/",
		flags = options.flags || "",
		globKey = `${glob}@${flags}/${+matchStart}${+matchEnd}@@${boundaryPrecursor}`;

	if (globCache.hasOwnProperty(globKey))
		return globCache[globKey];

	if (!boundaryCache.hasOwnProperty(boundaryPrecursor)) {
		// First escape properly, then clean that for regex construction
		const regexStr = cleanRegex(escape(boundaryPrecursor));
		boundaryCache[boundaryPrecursor] = regexStr ?
			`[^${regexStr}]` :
			".";
	}

	const boundary = boundaryCache[boundaryPrecursor];

	let isGlob = false,
		regex = glob.replace(globRegex, (match, escaped, wildcard, negate, charset, special) => {
			if (escaped)
				return match;

			if (wildcard) {
				isGlob = true;

				switch (wildcard) {
					case "?":
						return boundary;
					case "*":
						return `${boundary}*`;
					case "**":
						return ".*";
				}
			}

			if (charset) {
				isGlob = true;
				return `[${negate ? "^" : ""}${charset}]`;
			}

			return "\\" + special;
		});

	if (matchStart)
		regex = "^" + regex;
	if (matchEnd)
		regex = regex + "$";

	const parsed = {
		regex: new RegExp(regex, flags),
		isGlob
	};
	globCache[globKey] = parsed;
	return parsed;
}

const optionsTemplates = composeOptionsTemplates({
	noMatchStart: true,
	noMatchEnd: true,
	noMatchFull: true,
	g: {
		flags: "g"
	},
	i: {
		flags: "i"
	},
	gi: {
		flags: "gi"
	}
});

export {
	compileGlob
};
