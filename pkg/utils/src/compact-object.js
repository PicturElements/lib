import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import {
	isArrayKey,
	isNativeSimpleObject
} from "./is";
import { splitPath } from "./path";
import hasOwn from "./has-own";
import { isObject } from "./internal/duplicates";

const EXPAND_OPTIONS_TEMPLATES = composeOptionsTemplates({
	url: {
		splitOptions: "url"
	},
	joinArrays: {
		arrayMergeStrategy: "join"
	}
});

function expandCompactObject(obj, options) {
	options = options ?
		createOptionsObject(
			[options, { clone: true }],
			EXPAND_OPTIONS_TEMPLATES
		) :
		{ clone: true };

	const isArrKey = typeof options.isArrayKey == "function" ?
		options.isArrayKey :
		isArrayKey;

	return traverseCompactObject(obj, ({ value, parent, subPath }) => {
		let target = parent;

		for (let i = 0, l = subPath.length - 1; i < l; i++) {
			const component = subPath[i],
				nextComponent = subPath[i + 1];

			if (hasOwn(target, component)) {
				if (!target[component] || typeof target[component] != "object")
					throw new TypeError(`Failed to expand compressed object: property at ${component} is not an object`);
			} else
				target[component] = isArrKey(nextComponent) ? [] : {};

			target = target[component];
		}

		setValue(target, subPath[subPath.length - 1], value, options);
	}, options);
}

function getCompactObjectLeaves(obj, callback = null) {
	if (typeof callback == "function") {
		let count = 0;

		traverseCompactObject(obj, d => {
			count++;
			callback(d);
		}, {
			leavesOnly: true
		});

		return count;
	}

	const leaves = [];

	traverseCompactObject(obj, d => {
		d.subPath = d.subPath.slice();
		d.path = d.path.slice();
		leaves.push(d);
	}, {
		leavesOnly: true
	});

	return leaves;
}

const TRAVERSE_OPTIONS_TEMPLATES = composeOptionsTemplates({
	clone: true,
	detailed: true,
	leavesOnly: true
});

function traverseCompactObject(obj, callback, options) {
	return traverseCompactObjectHelper(
		obj,
		obj,
		"",
		[],
		[],
		callback,
		createOptionsObject(options, TRAVERSE_OPTIONS_TEMPLATES)
	);
}

function traverseCompactObjectHelper(value, parent, key, subPath, path, callback, options) {
	if (!isNativeSimpleObject(value)) {
		dispatch(key, value);
		return value;
	}

	const target = getTarget(value, options);
	if (parent == value)
		parent = target;

	const dispatch = (key, value, sPath = null) => {
		if (isNativeSimpleObject(value)) {
			const v = traverseCompactObjectHelper(
				value,
				value,
				"",
				[],
				path,
				callback,
				options
			);

			if (!options.leavesOnly) {
				callback({
					key,
					value: v,
					parent,
					subPath: sPath,
					path
				});
			}
		} else {
			callback({
				key,
				value,
				parent,
				subPath,
				path
			});
		}
	};

	if (options.detailed) {
		callback({
			key,
			value,
			parent,
			subPath: [key],
			path
		});
	}

	if (Array.isArray(value)) {
		const spIdx = subPath.push(0) - 1,
			pIdx = path.push(0) - 1;

		for (let i = 0, l = value.length; i < l; i++) {
			subPath[spIdx] = i;
			path[pIdx] = i;
			dispatch(i, value[i], subPath);
		}

		subPath.pop();
		path.pop();
		return target;
	}

	for (const k in value) {
		if (!hasOwn(value, k))
			continue;

		const p = splitPath(k, options.splitOptions),
			sPath = [];

		for (let i = 0, l = p.length; i < l; i++) {
			const key = p[i];

			sPath.push(key);
			subPath.push(key);
			path.push(key);

			if (options.detailed && i < l - 1) {
				callback({
					key: k,
					value: value[k],
					parent,
					subPath: sPath,
					path
				});
			}
		}

		dispatch(k, value[k], sPath);

		subPath.length -= p.length;
		path.length -= p.length;
	}

	return target;
}

function getTarget(candidate, options) {
	if (!options.clone)
		return candidate;

	return Array.isArray(candidate) ?
		[] :
		{};
}

function setValue(target, key, value, options) {
	const existingValue = target[key];

	if (isObject(value) && isObject(existingValue)) {
		for (const k in value) {
			if (hasOwn(value, k))
				setValue(existingValue, k, value[k], options);
		}
	} else if (Array.isArray(value) && Array.isArray(existingValue)) {
		for (let i = 0, l = value.length; i < l; i++) {
			switch (options.arrayMergeStrategy) {
				case "join":
					existingValue.push(value[i]);
					break;

				default:
					setValue(existingValue, i, value[i], options);
			}
		}
	} else
		target[key] = value;

	return value;
}

export {
	expandCompactObject,
	getCompactObjectLeaves,
	traverseCompactObject
};
