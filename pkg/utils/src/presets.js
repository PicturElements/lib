import {
	composeMergerTemplates,
	addMergerTemplate
} from "./internal/merge-obj";
import { isObject } from "./is";
import inject from "./inject";
import hasOwn from "./has-own";
import clone from "./clone";

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
	const visitedPresets = {};

	const merge = (out, root) => {
		const mrg = (outData, preset, force) => {
			if (!preset || (!force && typeof preset == "string" && hasOwn(visitedPresets, preset)))
				return null;

			if (typeof preset == "string")
				visitedPresets[preset] = true;

			if (Array.isArray(preset)) {
				// Run in reverse since inject calls don't overwrite written fields,
				// thereby giving later presets precedence over earlier presets
				for (let i = preset.length - 1; i >= 0; i--)
					outData = mrg(outData, preset[i], true) || outData;

				return outData;
			}

			if (isObject(preset)) {
				return inject(
					outData,
					merge(
						clone(preset, config),
						false
					),
					config.injectConfig
				);
			}

			if (typeof preset != "string") {
				console.error("Cannot inject preset: config must be a reference string or object");
				return null;
			}

			if (!hasOwn(presets, preset)) {
				console.error(`Cannot inject preset: ${preset} is not a known preset`);
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
		let changed = true;

		while (changed) {
			changed = false;

			for (let i = 0, l = keys.length; i < l; i++) {
				const key = keys[i],
					preset = out[key];

				if (!hasOwn(out, key))
					continue;
	
				changed = true;
				delete out[key];
				out = mrg(out, preset, false) || out;
			}
		}

		if (root && hasOwn(config, "defaultKey"))
			out = mrg(out, presets[config.defaultKey], false) || out;

		return out;
	};

	return merge(
		clone(data, config),
		true
	);
}

export {
	composePresets,
	addPreset,
	mergePresets
};
