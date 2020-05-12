import {
	stickyExec,
	stickyTest,
	cleanRegex,
	injectRegexFlags,
	compileStickyCompatibleRegex
} from "./regex";
import { isObject } from "./is";
import { spliceStr } from "./str";
import { unescape } from "./str-replace";
import { fitNum } from "./num";
import hasOwn from "./has-own";
import type from "./lazy/type";

// Patterns are combinations of regular expressions and blocks.
// These work on input strings to provide automatic formatting
// Expressions work like regular expressions, matching the provided string
// Blocks are dynamic pieces of content. Blocks can be either expansive and/or contractive
// Expansive blocks expand into text as soon as they are able to do so
// They do this if the content at the provided cursor matches all previous
// expressions and blocks
// Contractive blocks collapse and remove themselves as soon as they are able
// They do this when the content at the provided cursor is removed and
// formatting can be removed

const PATTERN_MATCHER_REGEX = /\/((?:[^\\/[]|\[(?:[^\\\]]|\\.)|\\.)+)\/|(<?>?)((?:[^\\/]|\\.)+)/g,
	PATTERN_CACHE = {};

function compilePatternMatcher(pattern) {
	if (pattern && pattern.isPattern)
		return pattern;

	const outPattern = [];

	if (typeof pattern == "string") {
		if (hasOwn(PATTERN_CACHE, pattern))
			return PATTERN_CACHE[pattern];

		while (true) {
			const ex = PATTERN_MATCHER_REGEX.exec(pattern);
			if (!ex)
				break;

			if (ex[1]) {
				let rx = compileStickyCompatibleRegex(ex[1]);

				if (rx instanceof Error) {
					console.warn(`Failed to compile pattern matcher: invalid regular expression /${ex[1]}/\n${rx.message}`);
					return [];
				}

				outPattern.push({
					type: "pattern",
					stickyRegex: rx,
					globalRegex: new RegExp(ex[1], "g")
				});
			} else {
				const growFlags = ex[2] || "",
					value = unescape(ex[3] || "");

				outPattern.push({
					type: "block",
					value,
					growFlags,
					length: value.length,
					expansive: !growFlags || growFlags.indexOf(">") > -1,
					contractive: !growFlags || growFlags.indexOf("<") > -1,
					stickyRegex: compileStickyCompatibleRegex(cleanRegex(value)),
					globalRegex: new RegExp(cleanRegex(value), "g")
				});
			}
		}

		PATTERN_CACHE[pattern] = outPattern;
	} else if (Array.isArray(pattern)) {
		for (let i = 0, l = pattern; i < l; i++) {
			const precursor = pattern[i];

			switch (type.of(precursor)) {
				case "regex":
					outPattern.push({
						type: "pattern",
						stickyRegex: compileStickyCompatibleRegex(precursor),
						globalRegex: injectRegexFlags(precursor, "g", true)
					});
					break;

				case "string": {
					outPattern.push({
						type: "block",
						value: precursor,
						growFlags: "",
						length: precursor.length,
						expansive: true,
						contractive: true,
						stickyRegex: compileStickyCompatibleRegex(cleanRegex(precursor)),
						globalRegex: new RegExp(cleanRegex(precursor), "g")
					});
					break;
				}
			}
		}
	}

	outPattern.isPattern = true;
	return outPattern;
}

function compilePatternMatcherGroup(configOrPatterns) {
	if (configOrPatterns && configOrPatterns.isPatternGroup)
		return configOrPatterns;

	const group = {
		lazy: true,
		patterns: [],
		resolve: null,
		normalize: null
	};

	if (Array.isArray(configOrPatterns))
		group.patterns = configOrPatterns;
	else
		Object.assign(group, configOrPatterns);

	const patterns = group.patterns,
		outPatterns = [],
		rawPatterns = [];

	for (let i = 0, l = patterns.length; i < l; i++) {
		let outPattern;

		if (isObject(patterns[i])) {
			outPattern = Object.assign({
				pattern: null,
				match: null
			}, patterns[i]);
		} else {
			outPattern = {
				pattern: patterns[i],
				match: null
			};
		}

		outPattern.pattern = compilePatternMatcher(outPattern.pattern);
		outPatterns.push(outPattern);
		rawPatterns.push(outPattern.pattern);
	}

	group.patterns = outPatterns;
	group.rawPatterns = rawPatterns;
	group.isPatternGroup = true;
	return group;
}

function resolvePattern(application, group) {
	const patterns = group.patterns;

	for (let i = 0, l = patterns.length; i < l; i++) {
		const { raw } = resolveRaw(application, patterns[i].pattern);

		if (qualifyPatternCell(application, patterns[i], raw))
			return patterns[i].pattern;
	}

	return [];
}

function resolvePatternLazy(application, patternOrGroup, str) {
	if (!patternOrGroup)
		return [];

	if (patternOrGroup.isPattern)
		return patternOrGroup;

	if (!patternOrGroup.isPatternGroup)
		return [];

	const group = patternOrGroup,
		patterns = group.patterns;

	if (typeof group.resolve == "function") {
		const resolved = group.resolve(application, group.rawPatterns, str) || [];
		return resolved.isPattern ? resolved : compilePatternMatcher(resolved);
	}

	for (let i = 0, l = patterns.length; i < l; i++) {
		if (qualifyPatternCell(application, patterns[i], str))
			return patterns[i].pattern;
	}

	return [];
}

function qualifyPatternCell(application, patternCell, str) {
	if (typeof patternCell.match == "function")
		return patternCell.match(application, str);

	if (patternCell.match instanceof RegExp)
		return patternCell.match.test(str);

	const cell = patternCell.pattern[0];
	if (!cell)
		return false;

	return stickyTest(cell.stickyRegex, str, 0);
}

function applyPattern(args = {}) {
	const source = String(args.source || "");

	let {
		start,
		end,
		insertion = "",
		deletion = 0,
		pattern = [],
		patterns = null
	} = args;

	if (typeof start != "number") {
		if (typeof end != "number")
			start = source.length;
		else
			start = end;
	}

	if (typeof end != "number")
		end = start;

	if (end < start)
		[start, end] = [end, start];

	start = fitNum(start, 0, source.length);
	end = fitNum(end, 0, source.length);
	insertion = String(insertion);

	if (typeof deletion == "number")
		deletion = Math.max(deletion || 0, 0);
	else
		deletion = 0;

	const application = {
		start,
		end,
		source,
		insertion,
		deletion,
		pattern,
		raw: null,
		sOffset: 0,
		eOffset: 0,
		output: null
	};
	let resolved;

	if (patterns) {
		const group = compilePatternMatcherGroup(patterns);
		let raw;

		if (group.lazy && group.normalize) {
			resolved = normalize(application, group.normalize);
			raw = splice(application, resolved.raw, resolved.sOffset, resolved.eOffset).raw;
			resolved.raw = raw;
		} else
			raw = splice(application, source).raw;

		if (group.lazy) {
			pattern = resolvePatternLazy(
				application,
				group,
				raw
			);
		} else {
			pattern = resolvePattern(application, group);
			resolved = resolveRaw(application, pattern);
		}
	} else {
		pattern = compilePatternMatcher(pattern);
		resolved = resolveRaw(application, pattern);
	}

	const {
		raw,
		sOffset,
		eOffset
	} = resolved;

	let output = "",
		idx = 0,
		ptr = start - sOffset + insertion.length,
		padding = insertion.length,
		activeBlock = null;

	const applyBlock = _ => {
		if (!activeBlock)
			return;

		output += activeBlock.value;
		if (idx < start - sOffset + padding) {
			ptr += activeBlock.length;
			padding += activeBlock.length;
		}

		activeBlock = null;
	};

	// Reconstruct the pattern
	for (let i = 0, l = pattern.length; i < l; i++) {
		const cell = pattern[i],
			ex = stickyExec(cell.stickyRegex, raw, idx);

		if (cell.type == "pattern") {
			if (ex) {
				applyBlock();
				output += ex[0];
				idx += ex[0].length;
			} else
				break;
		} else if (ex) {
			applyBlock();
			idx += ex[0].length;

			if (cell.expansive)
				output += cell.value;
		} else if (!ex && cell.expansive)
			activeBlock = cell;
	}

	application.start = Math.min(ptr, output.length);
	application.end = application.start;
	application.raw = raw;
	application.output = output;
	application.sOffset = sOffset;
	application.eOffset = eOffset;
	return application;
}

function resolveRaw(application, pattern) {
	const {
		raw,
		sOffset,
		eOffset
	} = resolveRawCore(application, pattern);

	return splice(application, raw, sOffset, eOffset);
}

function resolveRawCore(application, pattern) {
	const {
		start,
		end,
		source,
		resolveRawStr
	} = application;

	let raw = source,
		sOffset = 0,
		eOffset = 0;

	// Remove characters from the anchor point, though until
	// the extent point and update offsets accordingly
	const updateOffsets = (anchor, extent) => {
		sOffset += Math.min(Math.max(start - anchor, 0), extent - anchor);
		eOffset += Math.min(Math.max(end - anchor, 0), extent - anchor);
	};

	// Backtrack and extract the raw, unexpanded string
	if (typeof resolveRawStr == "function") {
		const resolved = resolveRawFunctional(application, resolveRawStr);
		if (resolved)
			return resolved;
	} else {
		let idx = 0;
		raw = "";

		for (let i = 0, l = pattern.length; i < l; i++) {
			const cell = pattern[i];

			if (cell.type == "pattern") {
				cell.globalRegex.lastIndex = idx;
				const ex = cell.globalRegex.exec(source);
				if (!ex) {
					updateOffsets(idx, source.length);
					break;
				}

				raw += ex[0];
				updateOffsets(idx, ex.index);
				idx = ex.index + ex[0].length;
			} else {
				const ex = stickyExec(cell.stickyRegex, source, idx);
				if (!ex)
					continue;

				if (cell.contractive)
					updateOffsets(idx, ex.index + ex[0].length);
				else
					raw += ex[0];
				idx = ex.index + ex[0].length;
			}
		}
	}

	return {
		raw,
		sOffset,
		eOffset
	};
}

function resolveRawFunctional(application, resolver) {
	const resolved = resolver(application);

	if (Array.isArray(resolved)) {
		return {
			raw: resolved[0],
			sOffset: resolved[1],
			eOffset: typeof resolved[2] == "number" ?
				resolved[2] :
				resolved[1]
		};
	} 
	
	if (isObject(resolved)) {
		return {
			raw: resolved.raw,
			sOffset: resolved.sOffset,
			eOffset: typeof resolved.eOffset == "number" ?
				resolved.eOffset :
				resolved.sOffset
		};
	}
	
	console.warn("resolveRawStr must return [raw, startOffset [, endOffset]] or { raw, startOffset [, endOffset] }");
	return null;
}

function splice(application, str, sOffset = 0, eOffset = 0) {
	const {
		start,
		end,
		source,
		insertion,
		deletion
	} = application;

	sOffset += deletion;
	str = spliceStr(
		str,
		fitNum(start - sOffset, 0, source.length),
		fitNum(end - eOffset, 0, source.length),
		insertion
	);

	return {
		raw: str,
		sOffset,
		eOffset
	};
}

function normalize(application, normalizer) {
	const {
		start,
		end,
		source
	} = application;

	if (typeof normalizer == "string")
		normalizer = new RegExp(normalizer, "g");
	else if (typeof normalizer == "function")
		return resolveRawFunctional(application, normalizer) || defResolveResponse(source);

	if (!(normalizer instanceof RegExp))
		return defResolveResponse(source);

	let raw = "",
		sOffset = 0,
		eOffset = 0;

	// Remove characters from the anchor point, though until
	// the extent point and update offsets accordingly
	const updateOffsets = (anchor, extent) => {
		sOffset += Math.min(Math.max(start - anchor, 0), extent - anchor);
		eOffset += Math.min(Math.max(end - anchor, 0), extent - anchor);
	};

	let idx = 0;

	while (true) {
		const ex = normalizer.exec(source);
		if (!ex || (idx && !normalizer.global)) {
			raw += source.substr(idx, source.length);
			break;
		}

		raw += source.substring(idx, ex.index);
		updateOffsets(ex.index, ex.index + ex[0].length);
		idx = ex.index + ex[0].length;
	}

	return {
		raw,
		sOffset,
		eOffset
	};
}

function defResolveResponse(source) {
	return {
		raw: source,
		sOffset: 0,
		eOffset: 0
	};
}

export {
	compilePatternMatcher,
	compilePatternMatcherGroup,
	applyPattern
};
