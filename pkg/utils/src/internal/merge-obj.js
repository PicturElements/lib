import {
	isObject,
	create,
	assign
} from "./duplicates";
import { getEnvType } from "../env";
import hasOwn from "../has-own";

// To reduce call overhead, functions in this file take a large number of arguments.
// It's recommended that these functions never face public APIs, but rather
// are called through separate, specific abstractions (see: options.js, presets.js)

const BLANK = Object.freeze({});

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
	enclose = false
) {
	switch (typeof mergerPrecursor) {
		case "string":
			return templates[mergerPrecursor] || tryBundle(mergerPrecursor, templates, type) || (
				logMergeError(error, mergerPrecursor, templates, type) ||
				BLANK
			);

		case "object":
			if (Array.isArray(mergerPrecursor))
				return mergeArray(mergerPrecursor, templates, error, type, merger, enclose);

			if (!mergerPrecursor)
				return BLANK;

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
	enclose = false
) {
	switch (typeof precursor) {
		case "string":
			return templates[precursor] || tryBundle(precursor, templates, type) || (
				logMergeError(error, precursor, templates, type) ||
				mergeObject(def, templates, error, type, merger, enclose)
			);

		case "object":
			if (Array.isArray(precursor))
				return mergeArray(precursor, templates, error, type, merger, enclose);

			return precursor ?
				precursor :
				mergeObject(def, templates, error, type, merger, enclose);

		default:
			return mergeObject(def, templates, error, type, merger, enclose);
	}
}

function tryBundle(
	refsStr,
	templates,
	type = "merge"
) {
	if (refsStr.indexOf("|") == -1)
		return null;

	const refs = refsStr.trim().split(/\s*\|\s*/),
		template = {};

	for (let i = 0, l = refs.length; i < l; i++) {
		const templ = templates[refs[i]];

		if (templ)
			assign(template, templ);
		else {
			console.error(`Failed to bundle ${type} object '${refs[i]}': no template with that name exists`);
			return null;
		}
	}

	templates[refsStr] = Object.freeze(template);
	return templates[refsStr];
}

function logMergeError(
	error,
	source,
	templates,
	type = "merge"
) {
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

// Merges arrays into singular objects
// Groups ref strings and bundles/caches the resulting object,
// ignores invalid data, and combines resolved data if necessary
function mergeArray(
	sources,
	templates,
	error,
	type = "merge",
	merger = assign,
	enclose = false
) {
	const resolved = [];
	let refsStr = "";

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
		resolved.push(
			mergeObject(
				data,
				templates,
				error,
				type,
				merger,
				false
			)
		);
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

	return enclose ?
		Object.freeze(out) :
		out;
}

export {
	composeMergerTemplates,
	addMergerTemplate,
	mergeObject,
	mergeObjectWithDefault
};
