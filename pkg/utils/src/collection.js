import {
	isObject,
	isArrayLike
} from "./is";
import {
	isMapLike,
	isSetLike
} from "./lazy/is";

// Utilities pertinent to collection data types,
// e.g. Object, Array, Map, Set, HTML collections, etc
function setEntry(target, ...kv) {
	if (typeof target == "string") {
		const [key, value, originalValue] = kv,
			idx = Number(key),
			ovLen = typeof originalValue == "string" ?
				originalValue.length :
				1;

		if (isNaN(idx) || !isFinite(idx) || idx < 0 || idx >= target.length)
			return target;

		return target.slice(0, idx) + String(value) + target.slice(idx + ovLen);
	}

	return mkEntrySetter(target)(...kv);
}

function mkEntrySetter(target) {
	if (!target)
		return _ => null;

	if (typeof target == "string") {
		const boxed = {
			shiftMap: [],
			value: target
		};
		
		return (key, value, originalValue) => {
			const idx = Number(key),
				ovLen = typeof originalValue == "string" ?
					originalValue.length :
					1;

			if (isNaN(idx) || !isFinite(idx) || idx < 0 || idx >= target.length)
				return target;

			value = String(value);
			boxed.value = boxed.value.slice(0, idx + (boxed.shiftMap[idx] || 0)) +
				value +
				boxed.value.slice(idx + (boxed.shiftMap[idx] || 0) + ovLen);

			const delta = value.length - ovLen;
			if (!delta)
				return boxed.value;

			if (!boxed.shiftMap.length) {
				for (let i = 0, l = target.length; i < l; i++)
					boxed.shiftMap.push(0);
			}

			for (let i = idx, l = boxed.shiftMap.length; i < l; i++)
				boxed.shiftMap[i] += delta;

			return boxed.value;
		};
	}

	if (Array.isArray(target)) {
		return (...kv) => {
			if (kv.length > 1)
				target[kv[0]] = kv[1];
			else
				target.push(kv[0]);

			return target;
		};
	}

	if (isObject(target) || isArrayLike(target)) {
		return (key, value) => {
			target[key] = value;
			return target;
		};
	}

	if (isMapLike(target) && typeof target.set == "function") {
		return (key, value) => {
			target.set(key, value);
			return target;
		};
	}

	if (isSetLike(target) && typeof target.add == "function") {
		return (...kv) => {
			if (kv.length > 1)
				target.add(kv[1]);
			else
				target.add(kv[0]);
			return target;
		};
	}

	return _ => null;
}

function isCollection(candidate) {
	return isObject(candidate) || isArrayLike(candidate) || isMapLike(candidate) || isSetLike(candidate);
}

export {
	setEntry,
	mkEntrySetter,
	isCollection
};
