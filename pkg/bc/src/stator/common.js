import {
	sym,
	normalizePath
} from "@qtxr/utils";

const NODE_RUNTIME_SYM = sym("runtime"),
	NODE_MANAGER_SYM = sym("node manager"),
	ACTION_RUNTIME_SYM = sym("action runtime"),
	TRANSFORMS_SYM = sym("transforms");

function toPath(partitionName) {
	const ex = /(?:(\w+):)?(.+)/.exec(partitionName);
	if (!ex)
		return null;

	const normalized = normalizePath.with({ split: "glob", join: "url" })(ex[2]);

	if (ex[1])
		return `${ex[1]}:${normalized}`;

	return normalized;
}

function mkReceipt(action, node, runtime, newValue, oldValue) {
	return {
		action,
		node,
		runtime,
		key: runtime.key,
		path: runtime.path,
		accessor: runtime.accessor,
		value: newValue,
		newValue,
		new: newValue,
		oldValue,
		old: oldValue
	};
}

export {
	NODE_RUNTIME_SYM,
	NODE_MANAGER_SYM,
	ACTION_RUNTIME_SYM,
	TRANSFORMS_SYM,
	toPath,
	mkReceipt
};
