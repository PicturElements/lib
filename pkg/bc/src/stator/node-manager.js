import { hasOwn } from "@qtxr/utils";
import {
	NODE_RUNTIME_SYM,
	ACTION_RUNTIME_SYM,
	mkReceipt
} from "./common";

// Updates nodes and their relation to parents
export default class NodeManager {
	constructor(owner) {
		this.owner = owner;
		this.nodes = {};
		this.size = 0;
	}

	has(nodeOrPath) {
		const path = typeof nodeOrPath == "string" ?
			nodeOrPath :
			nodeOrPath.path;

		return hasOwn(this.nodes, path);
	}

	add(node, value = node) {
		const runtime = node[NODE_RUNTIME_SYM],
			key = runtime.key,
			parent = runtime.parent,
			parentRuntime = parent[NODE_RUNTIME_SYM];

		parentRuntime.size++;
		parent[key] = value;
		parentRuntime.store[key] = node;

		this.size++;

		this.nodes[runtime.path] = node;
		if (runtime.accessor != runtime.path)
			this.nodes[runtime.accessor] = node;

		const receipt = mkReceipt(
			"add",
			node,
			runtime,
			value,
			undefined
		);

		this.dispatchEvents(receipt);

		return receipt;
	}

	update(node, value, oldValue) {
		const runtime = node[NODE_RUNTIME_SYM],
			key = runtime.key,
			parent = runtime.parent,
			force = oldValue !== undefined;

		if (!force)
			oldValue = parent[key];

		if (!force && value == oldValue)
			return null;

		parent[key] = value;
		runtime.updates++;

		const receipt = mkReceipt(
			"update",
			node,
			runtime,
			value,
			oldValue
		);

		this.dispatchEvents(receipt);

		return receipt;
	}

	delete(node) {
		const runtime = node[NODE_RUNTIME_SYM],
			key = runtime.key,
			parent = runtime.parent,
			value = parent[key],
			parentRuntime = parent[NODE_RUNTIME_SYM];

		parentRuntime.size--;
		delete parent[key];
		delete parentRuntime.store[key];

		this.size--;

		delete this.nodes[runtime.path];
		if (runtime.accessor != runtime.path)
			delete this.nodes[runtime.accessor];

		const receipt = mkReceipt(
			"delete",
			node,
			runtime,
			value,
			value
		);

		this.dispatchEvents(receipt);

		return receipt;
	}

	dispatchEvents(receipt) {
		const art = this.owner[ACTION_RUNTIME_SYM];
		if (art.flags.trackAny && art.flags.track[receipt.action])
			art.changes.push(receipt);

		this.owner.callHooks(`${receipt.action}:${receipt.path}`, receipt);
		this.owner.callHooks(receipt.path, receipt);
	}
}
