import {
	isObject,
	create,
	assign
} from "./duplicates";
import { LFUCache } from "./cache";
import { getEnvType } from "../env";
import hasOwn from "../has-own";

// To reduce call overhead, functions in this file accept a large number of arguments
// It's recommended that these functions never face public APIs, but rather
// are called through separate, specific abstractions (see: options.js, presets.js)

const BLANK = Object.freeze({}),
	SPLIT_CACHE = new LFUCache(),
	EMPTY_KEY = typeof Symbol == "undefined" ?
		"empty " + (1e6 + Math.random(1e6)).toString(36) :
		Symbol("empty"),
	REST_REF_KEY = typeof Symbol == "undefined" ?
		"rest templates " + (1e6 + Math.random(1e6)).toString(36) :
		Symbol("rest templates");

function composeMergerTemplates(...templates) {
	const templatesOut = create(null);

	for (let i = 0, l = templates.length; i < l; i++) {
		const template = templates[i];

		if (!template || typeof template != "object")
			continue;

		for (const k in template) {
			if (!hasOwn(template, k, false))
				continue;

			templatesOut[k] = Object.freeze(
				isObject(template[k]) ?
					template[k] :
					{
						[k]: template[k]
					}
			);
		}
	}

	return templatesOut;
}

function addMergerTemplate(
	templates,
	key,
	template,
	type = "merge"
) {
	if (typeof key != "string") {
		console.error(`Failed to create ${type} template: key is not a string`);
		return templates;
	}

	templates[key] = Object.freeze(
		isObject(template) ?
			template :
			{
				[key]: template
			}
	);

	return templates;
}

function mergeObject(
	mergerPrecursor,
	templates,
	error,
	type = "merge",
	merger = assign,
	enclose = false,
	withRest = false
) {
	switch (typeof mergerPrecursor) {
		case "string":
			return templates[mergerPrecursor] || tryBundle(mergerPrecursor, templates, type, withRest) || (
				logMergeError(error, mergerPrecursor, templates, type) ||
				BLANK
			);

		case "object":
			if (Array.isArray(mergerPrecursor))
				return mergeArray(mergerPrecursor, templates, error, type, merger, enclose, withRest);

			if (!mergerPrecursor)
				return BLANK;

			if (mergerPrecursor[REST_REF_KEY]) {
				const resolved = tryBundle(
					mergerPrecursor[REST_REF_KEY],
					templates,
					type,
					true,
					withRest
				);

				if (mergerPrecursor[EMPTY_KEY])
					return resolved;

				const assigned = assign(
					create(null),
					mergerPrecursor,
					resolved
				);

				if (assigned[REST_REF_KEY] && assigned[REST_REF_KEY] != resolved[REST_REF_KEY])
					delete assigned[REST_REF_KEY];

				return assigned;
			}

			if (enclose && Object.getPrototypeOf(mergerPrecursor)) {
				return assign(
					create(null),
					mergerPrecursor
				);
			}

			return mergerPrecursor;

		default:
			return BLANK;
	}
}

function mergeObjectWithDefault(
	precursor,
	templates,
	def,
	error,
	type = "merge",
	merger = assign,
	enclose = false,
	withRest = false
) {
	switch (typeof precursor) {
		case "string":
			return templates[precursor] || tryBundle(precursor, templates, type, withRest) || (
				logMergeError(error, precursor, templates, type) ||
				mergeObject(def, templates, error, type, merger, enclose, withRest)
			);

		case "object":
			if (Array.isArray(precursor))
				return mergeArray(precursor, templates, error, type, merger, enclose, withRest);

			return precursor ?
				precursor :
				mergeObject(def, templates, error, type, merger, enclose, withRest);

		default:
			return mergeObject(def, templates, error, type, merger, enclose, withRest);
	}
}

// Merges arrays into singular objects
// Groups ref strings and bundles/caches the resulting object,
// ignores invalid data, and combines resolved data if necessary
function mergeArray(
	sources,
	templates,
	error,
	type = "merge",
	merger = assign,
	enclose = false,
	withRest = false
) {
	const resolved = [];
	let refsStr = "",
		empty = true;

	const traverse = arr => {
		for (let i = 0, l = arr.length; i < l; i++) {
			const source = arr[i];

			if (typeof source == "string") {
				refsStr += refsStr ?
					`|${source}` :
					source;
			} else if (Array.isArray(source))
				traverse(source);
			else if (isObject(source)) {
				if (refsStr) {
					resolve(refsStr);
					refsStr = "";
				}

				resolve(source);
			}
		}
	};

	const resolve = data => {
		const merged = mergeObject(
			data,
			templates,
			error,
			type,
			merger,
			false,
			withRest
		);

		if (typeof data == "object" || !merged[EMPTY_KEY])
			empty = false;

		resolved.push(merged);
	};

	traverse(sources);

	if (refsStr)
		resolve(refsStr);

	if (resolved.length == 1)
		return resolved[0];
	if (!resolved.length)
		return enclose ? BLANK : {};

	const out = enclose ?
		create(null) :
		{};

	for (let i = 0, l = resolved.length; i < l; i++) {
		if (resolved[i])
			merger(out, resolved[i]);
	}

	if (!empty && out[EMPTY_KEY])
		delete out[EMPTY_KEY];

	return enclose ?
		Object.freeze(out) :
		out;
}

function tryBundle(
	refsData,
	templates,
	type = "merge",
	withRest = false,
	propagate = true
) {
	const template = create(null);
	let cachable = typeof refsData == "string",
		refs = refsData,
		empty = true;

	if (cachable) {
		if (SPLIT_CACHE.has(refs))
			refs = SPLIT_CACHE.get(refs);
		else {
			const cacheKey = refs;
			refs = refs.indexOf("|") == -1 ?
				[refs.trim()] :
				refs.trim().split(/\s*\|\s*/);
			SPLIT_CACHE.set(cacheKey, refs);
		}

		if (!withRest && refs.length == 1)
			return null;
	}

	for (let i = 0, l = refs.length; i < l; i++) {
		const templ = templates[refs[i]];

		if (templ) {
			assign(template, templ);
			empty = false;
		} else if (withRest && propagate) {
			cachable = false;
			template[REST_REF_KEY] = template[REST_REF_KEY] || [];
			template[REST_REF_KEY].push(refs[i]);
		} else if (propagate) {
			console.error(`Failed to bundle ${type} object '${refs[i]}': no template with that name exists`);
			return null;
		}
	}

	if (cachable) {
		Object.freeze(template);
		templates[refsData] = template;
	} else if (withRest && template[REST_REF_KEY] && empty)
		template[EMPTY_KEY] = true;

	return template;
}

function logMergeError(
	error,
	source,
	templates,
	type = "merge"
) {
	if (typeof error == "function")
		console.error(error(source, templates, type));
	else
		console.error(error || `'${source}' is not a valid ${type} object`);

	if (getEnvType() != "window")
		return;

	console.groupCollapsed("Expand to view all currently supported templates");
	const keys = Object.keys(templates).sort();

	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i];
		if (key.indexOf("|") != -1)
			continue;

		console.groupCollapsed(key);
		console.log(templates[key]);
		console.groupEnd();
	}

	console.groupEnd();
}

export {
	composeMergerTemplates,
	addMergerTemplate,
	mergeObject,
	mergeObjectWithDefault
};
