import {
	createOptionsObject,
	composeOptionsTemplates
} from "./internal/options";
import { mkDisallowedWordsRegex } from "./regex";
import { unescape } from "./str";
import hasOwn from "./has-own";

const GLOB_REGEX = /\\([^\\/])|(\?|\*{1,2})|\[(?!])(!)?((?:[^\\/]|\\.)*?)\]|([$^()[\]/\\{}.*+?|])/g,
	GLOB_COMPONENT_REGEX = /(?:[^\\]|^)(?:\?|\*{1,2}|\[(?!])(?:[^\\/]|\\.)*?\])/,
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
		boundaryPrecursor = typeof options.boundary == "string" || Array.isArray(options.boundary) ?
			options.boundary :
			"/",
		boundaryKey = Array.isArray(boundaryPrecursor) ?
			boundaryPrecursor.join("//") :
			boundaryPrecursor,
		flags = options.flags || "",
		globKey = `${glob}@${flags}/${Number(matchStart)}${Number(matchEnd)}@@${boundaryKey}`;

	if (hasOwn(GLOB_CACHE, globKey))
		return GLOB_CACHE[globKey];

	if (!hasOwn(BOUNDARY_CACHE, boundaryKey))
		BOUNDARY_CACHE[boundaryPrecursor] = mkDisallowedWordsRegex(boundaryPrecursor);

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

				if (charset[0] == "^")
					charset = "\\" + unescape(charset);
				else
					charset = unescape(charset);

				charset = charset.replace(/]/, "\\]");

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
		isGlob,
		isGlobCompileResult: true
	};
	GLOB_CACHE[globKey] = parsed;
	return parsed;
}

function matchGlob(str, glob, options) {
	if (typeof str != "string")
		return false;
	
	if (glob && glob.isGlobCompileResult && glob.regex instanceof RegExp)
		return glob.regex.test(str);

	if (typeof glob != "string")
		return false;

	return compileGlob(glob, options).regex.test(str);
}

function isGlob(candidate) {
	if (typeof candidate != "string")
		return false;

	return GLOB_COMPONENT_REGEX.test(candidate);
}

export {
	compileGlob,
	matchGlob,
	isGlob
};
