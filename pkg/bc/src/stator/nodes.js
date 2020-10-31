import {
	hasOwn,
	joinPath,
	isObject,
	setSymbol,
	expandCompactObject
} from "@qtxr/utils";
import {
	TRANSFORMS_SYM,
	NODE_RUNTIME_SYM
} from "./common";

// Nodes and node data
class StatorObjectNode {
	constructor(art, parent, key, value) {
		initNode(art, this, {
			parent,
			key,
			value,
			store: {}
		});
	}
}

class StatorArrayNode extends Array {
	constructor(art, parent, key, value) {
		super();
		initNode(art, this, {
			parent,
			key,
			value,
			store: []
		});
	}
}

class StatorValueNode {
	constructor(art, parent, key, value) {
		initNode(art, this, {
			parent,
			key,
			value
		});
	}
}

function initNode(art, node, data) {
	const parentRuntime = (data.parent && data.parent[NODE_RUNTIME_SYM]) || {
		path: "",
		accessor: ""
	};

	const runtime = {
		// General data
		parent: data.parent,
		key: data.key,
		// Derived data
		path: joinPathFast(parentRuntime.path, data.key),
		accessor: joinAccessorFast(parentRuntime.accessor, data.key),
		// Meta state
		updates: 0
	};

	if (data.store) {
		runtime.store = data.store;
		runtime.size = 0;
	}

	setSymbol(node, NODE_RUNTIME_SYM, runtime);

	if (!(node instanceof StatorValueNode))
		setState(art, node, data.value);

	return node;
}

// State management
function assignState(art, parent, pathOrValue, value) {
	let target = parent;

	if (typeof pathOrValue == "string") {
		const abs = joinPathOrAccessor(parent[NODE_RUNTIME_SYM], pathOrValue);
		target = art.nodeManager.nodes[abs];

		if (!isStatorNode(target)) {
			target = parent;
			value = expandCompactObject({
				[pathOrValue]: value
			});
		} else if (art.flags.expandObjects)
			value = expandCompactObject(value);
	} else if (isObject(pathOrValue)) {
		value = pathOrValue;

		if (art.flags.expandObjects)
			value = expandCompactObject(value);
	} else
		throw new TypeError(`Failed to assign state: arguments must be either <string, any> or <object>`);

	if (target instanceof StatorValueNode) {
		setValue(
			art,
			target,
			value
		);
	} else {
		if (!isObject(value))
			throw new TypeError("Failed to assign state: root state must be an object");

		setState(
			art,
			target,
			value
		);
	}
}

function setState(art, parent, value) {
	switch (getValueType(value)) {
		case "object":
			for (const k in value) {
				if (hasOwn(value, k))
					setProperty(art, parent, k, value[k]);
			}
			break;
		
		case "array":
			for (let i = 0, l = value.length; i < l; i++)
				setProperty(art, parent, i, value[i]);
			break;

		default:
			throw new TypeError("Cannot set state: value is primitive or not applicable");
	}
}

function setValue(art, node, value) {
	const runtime = node[NODE_RUNTIME_SYM],
		parent = runtime.parent;

	return setProperty(art, parent, runtime.key, value);
}

function setProperty(art, parent, key, value) {
	const runtime = parent[NODE_RUNTIME_SYM],
		store = runtime.store,
		childRuntime = store[key] && store[key][NODE_RUNTIME_SYM],
		path = childRuntime && childRuntime.path || joinPathFast(runtime.path, key),
		hasTransform = hasOwn(art.stator[TRANSFORMS_SYM], path);
	let oldValue = parent[key];

	if (hasTransform && art.flags.preserveOldState)
		oldValue = copyValue(oldValue);

	if (hasOwn(store, key) && getValueType(value) != getValueType(store[key]))
		deleteProperty(art, parent, key);

	let receipt;

	if (hasOwn(store, key))
		receipt = updateProperty(art, parent, key, value, oldValue);
	else
		receipt = addProperty(art, parent, key, value);

	if (hasTransform && receipt) {
		art.stator[TRANSFORMS_SYM][path].apply(
			art,
			receipt.action,
			receipt.value,
			oldValue
		);
	}

	return receipt;
}

function addProperty(art, parent, key, value) {
	switch (getValueType(value)) {
		case "object":
			return art.nodeManager.add(
				new StatorObjectNode(art, parent, key, value)
			);
		
		case "array":
			return art.nodeManager.add(
				new StatorArrayNode(art, parent, key, value)
			);

		case "value":
			return art.nodeManager.add(
				new StatorValueNode(art, parent, key, value),
				value
			);

		default:
			throw new Error(`Cannot add property: unknown value type '${getValueType(value)}'`);
	}
}

function updateProperty(art, parent, key, value, oldValue) {
	const child = parent[NODE_RUNTIME_SYM].store[key];
	let changed = 0;

	switch (getValueType(value)) {
		case "object":
			for (const k in value) {
				if (!hasOwn(value, k))
					continue;

				changed |= (setProperty(art, child, k, value[k]) !== null);
			}
			break;
		
		case "array":
			for (let i = 0, l = value.length; i < l; i++)
				changed |= (setProperty(art, child, i, value[i]) !== null);
			break;

		case "value":
			return art.nodeManager.update(child, value);

		default:
			throw new Error(`Cannot update property: unknown value type '${getValueType(value)}'`);
	}

	if (!changed || !art.flags.bubble)
		return null;

	return art.nodeManager.update(child, value, oldValue);
}

function deleteProperty(art, parent, key) {
	const child = parent[NODE_RUNTIME_SYM].store[key];

	if (!art.flags.recursiveDelete)
		return art.nodeManager.delete(child);

	switch (getValueType(child)) {
		case "object":
			for (const k in child) {
				if (hasOwn(child, k))
					deleteProperty(art, child, k);
			}
			break;

		case "array":
			for (let i = 0, l = child.length; i < l; i++) {
				if (hasOwn(child, i))
					deleteProperty(art, child, i);
			}
			break;
	}

	return art.nodeManager.delete(child);
}

// Utilities
function isStatorNode(candidate) {
	return candidate instanceof StatorObjectNode ||
		candidate instanceof StatorArrayNode ||
		candidate instanceof StatorValueNode;
}

function getValueType(candidate) {
	if (isObject(candidate) || candidate instanceof StatorObjectNode)
		return "object";

	if (Array.isArray(candidate) || candidate instanceof StatorArrayNode)
		return "array";

	return "value";
}

function joinPathFast(parentPath, component) {
	if (parentPath) {
		if (typeof component != "string")
			return `${parentPath}/${component}`;

		return `${parentPath}/${component.replace(/\//g, "\\/")}`;
	}

	if (typeof component != "string")
		return String(component);

	return String(component).replace(/\//g, "\\/");
}

function joinAccessorFast(parentAccessor, component) {
	if (parentAccessor) {
		if (typeof component != "string")
			return `${parentAccessor}[${component}]`;

		const newComp = joinPath(component);
		return newComp[0] == "[" ?
			parentAccessor + newComp :
			`${parentAccessor}.${newComp}`;
	}

	if (typeof component != "string")
		return `[${component}]`;

	return joinPath(component);
}

function joinPathOrAccessor(rt, pathOrAccessor) {
	if (!rt.path)
		return pathOrAccessor;

	if (pathOrAccessor.indexOf("/") > -1)
		return `${rt.path}/${pathOrAccessor}`;

	return `${rt.accessor}.${pathOrAccessor}`;
}

function copyValue(value) {
	if (!value || typeof value != "object")
		return value;

	if (value instanceof StatorObjectNode) {
		const out = {};

		for (const k in value) {
			if (hasOwn(value, k))
				out[k] = copyValue(value[k]);
		}

		return out;
	}

	if (value instanceof StatorArrayNode) {
		const out = [];

		for (let i = 0, l = value.length; i < l; i++)
			out.push(copyValue(value[i]));

		return out;
	}

	return value;
}

export {
	// Nodes
	StatorObjectNode,
	StatorArrayNode,
	StatorValueNode,
	// Meta / utilities
	initNode,
	assignState,
	setState,
	setValue,
	setProperty,
	deleteProperty,
	isStatorNode
};
