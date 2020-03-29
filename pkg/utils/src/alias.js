
import {
	isObject,
	isValidObjectKey
} from "./is";
import hasOwn from "./has-own";
import get from "./get";

function aliasCore(target, keyOrMap, shallow, ...aliases) {
	let appliedCount = 0;

	const apply = (key, alis) => {
		console.log(target, key, alis);

		const ctx = get(target, key, null, "context");
		if (!ctx.match)
			return;

		key = ctx.key;
		alis = Array.isArray(alis) ? alis : [alis];

		let descriptor,
			owner = ctx.context;

		while (true) {
			if (!owner)
				break;

			descriptor = Object.getOwnPropertyDescriptor(owner, key);
	
			if (descriptor || shallow)
				break;
	
			owner = Object.getPrototypeOf(owner);
		}

		if (!descriptor)
			return;

		for (let i = 0, l = alis.length; i < l; i++) {
			if (!isValidObjectKey(alis[i]))
				continue;

			const ctx2 = get(target, alis[i], null, "context|autoBuild");
			Object.defineProperty(ctx2.context, ctx2.key, descriptor);
			appliedCount++;
		}
	};

	if (isObject(keyOrMap)) {
		if (aliases.length)
			console.warn("Alias arguments are ignored if a key map is supplied");

		for (const k in keyOrMap) {
			if (hasOwn(keyOrMap, k))
				apply(k, keyOrMap[k]);
		}
	} else
		apply(keyOrMap, aliases);
	
	return appliedCount;
}

function alias(target, keyOrMap, ...aliases) {
	return aliasCore(target, keyOrMap, false, ...aliases);
}

function aliasOwn(target, keyOrMap, ...aliases) {
	return aliasCore(target, keyOrMap, false, ...aliases);
}

export {
	alias,
	aliasOwn
};
