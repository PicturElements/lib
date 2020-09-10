import { escape } from "./str-replace";
import { cleanRegex } from "./regex";
import hasOwn from "./has-own";
import {
	createOptionsObject,
	composeOptionsTemplates
} from "./internal/options";

const GLOB_REGEX = /\\([^\\/])|(\?|\*\*|\*)|\[(!)?([^\\/]*?)\]|([$^()[\]/\\{}.*+?|])/g,
	GLOB_CACHE = {},
	BOUNDARY_CACHE = {};
	
const OPTIONS_TEMPLATES = composeOptionsTemplates({
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

function compileGlob(glob, options) {
	if (typeof glob != "string")
		return null;

	options = createOptionsObject(options, OPTIONS_TEMPLATES);

	const matchStart = !options.noMatchStart && !options.noMatchFull,
		matchEnd = !options.noMatchEnd && !options.noMatchFull,
		boundaryPrecursor = typeof options.boundary == "string" ? options.boundary : "\\/",
		flags = options.flags || "",
		globKey = `${glob}@${flags}/${+matchStart}${+matchEnd}@@${boundaryPrecursor}`;

	if (hasOwn(GLOB_CACHE, globKey))
		return GLOB_CACHE[globKey];

	if (!hasOwn(BOUNDARY_CACHE, boundaryPrecursor)) {
		// First escape properly, then clean that for regex construction
		const regexStr = cleanRegex(escape(boundaryPrecursor));
		BOUNDARY_CACHE[boundaryPrecursor] = regexStr ?
			`[^${regexStr}]` :
			".";
	}

	const boundary = BOUNDARY_CACHE[boundaryPrecursor];

	let isGlob = false,
		regex = glob.replace(GLOB_REGEX, (
			match,
			escaped,
			wildcard,
			negate,
			charset,
			special
		) => {
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
	GLOB_CACHE[globKey] = parsed;
	return parsed;
}

function matchGlob(str, glob, options) {
	if (typeof str != "string" || typeof glob != "string")
		return false;

	return compileGlob(glob, options).regex.test(str);
}

export {
	compileGlob,
	matchGlob
};
