import {
	round,
	clone,
	hasOwn,
	isObject,
	mergesort,
	concatMut,
	regexReduce
} from "@qtxr/utils";
import { Ease } from "@qtxr/anim";
import interpolatorData from "./interpolator-data";

// Classes used for interpolation
import Color, { Gradient } from "@qtxr/color";

// Prepares keyframes in the followinf ways:
// 1. Normalizes keyframes (creates an array of objects wrapping the original keyframes)
// 2. Cleans keyframes based on positions (at value)
// 3. Compiles easing functions
// 4. Extrapolates missing data
// 5. Injects metadata
function prepareKeyframes(keyframes, options) {
	keyframes = normalizeKeyframes(keyframes, options);

	if (!keyframes || !keyframes.length)
		throw new RangeError("Cannot process keyframes because none are specified");

	cleanKeyframePositions(keyframes);
	compileEasings(keyframes);
	injectMetadata(keyframes);

	return keyframes;
}

function normalizeKeyframes(keyframes, options) {
	if (Array.isArray(keyframes))
		return formatKeyframes(keyframes, options);

	if (isObject(keyframes))
		return convertKeyframeObject(keyframes, options);

	return [
		formatKeyframe(keyframes)
	];
}

const singularKeyframeSelectorRegex = /^(?:from|to|[-\d.]+%)$/,
	multipleKeyframeSelectorRegex = /^(?:(?:from|to|[-\d.]+%)(?:\s*,\s*(?:from|to|[-\d.]+%))+)$/;

// Converts keyframe object into new array of keyframes
// if and only if all keys on the object follow the CSS keyframes
// at rule keyframe selector syntax ("x%", "from", "to", "point, point, ...")
// If not, the keyframe object will be formatted and wrapped in an array
// Invalid selectors and their corresponding values will be discarded
function convertKeyframeObject(keyframes, options) {
	const keyframeProcessors = [];

	for (const k in keyframes) {
		if (!hasOwn(keyframes, k))
			continue;

		if (singularKeyframeSelectorRegex.test(k)) {
			keyframeProcessors.push([k, parseSingularKeyframeSelector]);
			continue;
		}

		if (multipleKeyframeSelectorRegex.test(k)) {
			keyframeProcessors.push([k, parseMultipleKeyframeSelector]);
			continue;
		}

		// Object is not on proper CSS keyframe form - return as normal keyframe array
		return [
			formatKeyframe(keyframes, options)
		];
	}

	const outKeyframes = [];

	for (let i = 0, l = keyframeProcessors.length; i < l; i++) {
		const keyframe = formatKeyframe(keyframes[keyframeProcessors[i][0]], options),
			selector = keyframeProcessors[i][0],
			parser = keyframeProcessors[i][1],
			parsed = parser(keyframe, selector);

		if (parsed)
			concatMut(outKeyframes, parsed);
	}

	// This is only needed because object key order may not be preserved
	// The system as a whole requires keyframes to be chronologically sorted
	// and duplicate / out of place keyframes are removed
	// See cleanKeyframePositions for details
	return mergesort(outKeyframes, (a, b) => a.at - b.at);
}

// Keyframe is cloned because the function may be adding a property to it
// To err on the safe side, it's better to have it properly cloned
// so no accidental pollution happens to input data
function parseSingularKeyframeSelector(keyframe, selector) {
	keyframe = clone(keyframe);
	selector = selector.trim();

	let position = 0;

	switch (selector) {
		case "from":
			position = 0;
			break;

		case "to":
			position = 1;
			break;

		// Percentage (x%)
		default:
			position = Number(selector.substring(0, selector.length - 1)) / 100;
	}

	if (isNaN(position))
		return null;

	keyframe.at = position;
	return [keyframe];
}

function parseMultipleKeyframeSelector(keyframe, selector) {
	const selectors = selector.split(","),
		keyframes = [];

	for (let i = 0, l = selectors.length; i < l; i++) {
		const parsed = parseSingularKeyframeSelector(keyframe, selectors[i]);
		if (parsed)
			keyframes.push(parsed[0]);
	}

	return keyframes;
}

function formatKeyframe(keyframe, options = {}) {
	const formattedKeyframe = preprocessKeyframe(keyframe, options);
	let value = keyframe;

	if (typeof options.verify == "function")
		options.verify(keyframe);

	if (options.clone)
		value = clone(keyframe);

	if (isObject(keyframe)) {
		const keys = interpolatorData.reservedKeysList;
		for (let i = keys.length - 1; i >= 0; i--) {
			const key = keys[i];
			formattedKeyframe[key] = value[key];

			if (options.noDeleteKeys !== true)
				delete value[key];
		}
	}

	formattedKeyframe.value = value;
	return formattedKeyframe;
}

function formatKeyframes(keyframes, options = {}) {
	const outKeyframes = [];

	for (let i = 0, l = keyframes.length; i < l; i++)
		outKeyframes.push(formatKeyframe(keyframes[i], options));

	return outKeyframes;
}

function preprocessKeyframe(keyframe, options) {
	const formattedKeyframe = {
		raw: keyframe,
		isFormatted: true
	};

	if (options.parseStringKeyframes && typeof keyframe == "string")
		parseStringKeyframe(formattedKeyframe);

	return formattedKeyframe;
}

const eolControlKeyRegexes = [
	{
		key: "at",
		regex: /(\d+?)%\s*$/,
		capture: 1,
		process: val => Math.max(Math.min(((Number(val) || 0) / 100), 1), 0)
	},
	{
		key: "easing",
		regex: Ease.regexes.matchEnd,
		capture: 1
	}
];

function parseStringKeyframe(formattedKeyframe) {
	const extracted = regexReduce(formattedKeyframe.raw, formattedKeyframe, eolControlKeyRegexes);
	formattedKeyframe.raw = extracted.string.trim();
}

function injectMetadata(keyframes) {
	for (let i = 0, l = keyframes.length; i < l; i++) {
		const kf = keyframes[i];
		kf.idx = i;

		if (i) {
			kf.start = kf.at;
			kf.prev = keyframes[i - 1];
		} else {
			kf.start = 0;
			kf.prev = kf;
		}

		if (i < l - 1) {
			kf.end = keyframes[i + 1].at;
			kf.next = keyframes[i + 1];
		} else {
			kf.end = 1;
			kf.next = kf;
		}
	}
}

const KF_ACCURACY = 5;

// The system requires keyframes to be chronologically sorted
// and duplicate / out of place keyframes are removed
function cleanKeyframePositions(keyframes) {
	const endIdx = keyframes.length - 1;

	if (keyframes[0].at == null)
		keyframes[0].at = 0;

	if (keyframes[endIdx].at == null)
		keyframes[endIdx].at = 1;

	let lastIdx = 0,
		lastPosition = keyframes[lastIdx].at;

	for (let i = 1; i < keyframes.length; i++) {
		const currPosition = keyframes[i].at;

		// Skip keyframe entirely as to not update lastIdx, lastPosition
		if (currPosition == null)
			continue;

		// Interpolate keyframe percentages
		if (lastIdx < i - 1) {
			const steps = i - lastIdx;

			for (let j = lastIdx + 1; j < i; j++)
				keyframes[j].at = round(lastPosition + ((currPosition - lastPosition) / steps) * (j - lastIdx), KF_ACCURACY);
		}

		if (currPosition < lastPosition) {
			// If the current keyframe appears before than the last chronologically,
			// it will never be visited, as the time line can't go backwards 
			keyframes.splice(i, 1);
			i--;
		} else if (lastPosition == currPosition) {
			// For consecutive keyframes with the same percentage value, use the latter 
			keyframes.splice(i - 1, 1);
			i--;
		} else {
			lastPosition = currPosition;
			lastIdx = i;
		}
	}
}

function compileEasings(keyframes) {
	for (let i = keyframes.length - 1; i >= 0; i--)
		keyframes[i].easing = Ease.compile(keyframes[i].easing);
}

function getInterpolationPosition(kf, kf2, at) {
	return getInterpolationPositionRaw(kf.at, kf2.at, at);
}

function getInterpolationPositionRaw(pos, pos2, at) {
	if (pos == pos2)
		return at < pos ? 0 : 1;

	const outPos = (at - pos) / (pos2 - pos);
	return Math.max(Math.min(outPos, 1), 0);
}

// Assumes both data have identical form
function interpolate(data, data2, at, runtime) {
	switch (typeof data) {
		case "number":
			return data + (data2 - data) * at;
	}

	switch (data && data.constructor) {
		case Color:
			return Gradient.doInterpolation(data2, data, at, runtime);
	}

	if (Array.isArray(data)) {
		const out = [];

		for (let i = 0, l = data.length; i < l; i++)
			out.push(interpolate(data[i], data2[i], at, runtime));

		return out;
	}

	if (isObject(data)) {
		const out = {};

		for (const k in data) {
			if (!hasOwn(data, k))
				continue;

			out[k] = interpolate(data[k], data2[k], at, runtime);
		}

		return out;
	}

	return at == 1 ? data2 : data;
}

export {
	prepareKeyframes,
	formatKeyframes,
	getInterpolationPosition,
	getInterpolationPositionRaw,
	interpolate
};
