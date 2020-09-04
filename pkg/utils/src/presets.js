import { isObject } from "./is";
import inject from "./inject";
import serialize from "./serialize";
import hasOwn from "./has-own";
import clone from "./clone";
import {
	composeMergerTemplates,
	addMergerTemplate
} from "./internal/merge-obj";

function composePresets(...templates) {
	return composeMergerTemplates(...templates);
}

function addPreset(presets, key, preset) {
	return addMergerTemplate(
		presets,
		key,
		preset,
		"preset"
	);
}

function mergePresets(data, presets, config = {}) {
	const visitedKeys = {};

	const merge = out => {
		const mrg = (outData, preset, key, force) => {
			if (!key || !preset || (!force && hasOwn(visitedKeys, key)))
				return null;

			visitedKeys[key] = true;

			if (Array.isArray(preset)) {
				// Run in reverse since inject calls don't overwrite written fields,
				// thereby giving later presets precedence over earlier presets
				for (let i = preset.length - 1; i >= 0; i--)
					outData = mrg(outData, preset[i], key, true) || outData;

				return outData;
			}

			if (isObject(preset)) {
				return inject(
					outData,
					merge(preset),
					config.injectConfig
				);
			}

			if (typeof preset != "string") {
				console.error("Cannot inject preset: config must be a string name or object");
				return null;
			}

			if (!hasOwn(presets, preset)) {
				console.error(`Cannot inject preset: ${serialize(preset)} is not a valid name`);
				return null;
			}

			return inject(
				outData,
				presets[preset],
				config.injectConfig
			);
		};

		const k = config.key || config.keys,
			keys = Array.isArray(k) ? k : [k];

		if (hasOwn(config, "defaultKey"))
			out = mrg(out, presets[config.defaultKey], config.defaultKey) || out;

		for (let i = 0, l = keys.length; i < l; i++) {
			const key = keys[i],
				preset = out[key];

			delete out[key];
			out = mrg(out, preset, key) || out;
		}

		return out;
	};

	return merge(clone(data, config));
}

export {
	composePresets,
	addPreset,
	mergePresets
};
