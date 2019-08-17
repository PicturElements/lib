import {
	resolveVal,
	resolveValWithPassedFallback
} from "./resolve-val";

function regexReduce(str, target, handlers) {
	let iterations = 0;

	while (true) {
		const strLen = str.length;

		for (let i = 0, l = handlers.length; i < l; i++) {
			const handler = handlers[i];

			if (handler.multiple || handler.regex.global)
				str = regexReduceMultiple(str, target, handler);
			else
				str = regexReduceSingular(str, target, handler);
		}

		if (strLen == str.length)
			break;

		iterations++;
	}

	return {
		iterations,
		string: str,
		target
	};
}

function regexReduceSingular(str, target, handler) {
	const ex = resolveVal(handler.regex).exec(str);
	if (!ex)
		return str;

	target[handler.key] = resolveValWithPassedFallback(handler.process, ex[handler.capture || 0]);

	return str.substr(0, ex.index) + str.substr(ex.index + ex[0].length, str.length);
}

function regexReduceMultiple(str, target, handler) {
	let startIdx = -1,
		endIdx = -1;
	const reg = resolveVal(handler.regex),
		arr = [];

	while (true) {
		const ex = reg.exec(str);
		if (!ex)
			break;

		if (startIdx < 0)
			startIdx = ex.index;
		endIdx = ex.index + ex[0].length;

		arr.push(ex[handler.capture || 0]);
	}

	if (startIdx < 0)
		return str;

	target[handler.key] = resolveValWithPassedFallback(handler.process, arr);

	return str.substr(0, startIdx) + str.substr(endIdx, str.length - endIdx);
}

export {
	regexReduce,
	regexReduceSingular,
	regexReduceMultiple
};
