import {
	NODE_MANAGER_SYM,
	NODE_RUNTIME_SYM,
	ACTION_RUNTIME_SYM
} from "./common";
import { assignState } from "./nodes";

export default class Transform {
	constructor(owner, path, handler) {
		this.owner = owner;
		this.path = path;
		this.handler = handler;
		this.actionId = -1;
		this.applicationRuntime = mkApplicationRuntime(this);
	}

	apply(art, action, newValue, oldValue) {
		if (this.actionId == art.actionId)
			return false;
		
		this.actionId = art.actionId;

		const runtime = this.applicationRuntime;
		runtime.action = action;
		runtime.state = art.root;
		runtime.new = runtime.newValue = runtime.value = newValue;
		runtime.old = runtime.oldValue = oldValue;

		const res = this.handler(runtime);
		if (res && typeof res == "object")
			runtime.merge(res);
		else if (res != null) {
			assignState(
				art,
				this.owner[ACTION_RUNTIME_SYM].root,
				this.path,
				res
			);
		}

		return true;
	}
}

function mkApplicationRuntime(inst) {
	const runtime = {
		// Fundamental
		action: null,
		state: null,
		stator: inst.owner,
		targetNode: null,
		targetRuntime: null,
		targetParent: null,
		// Values and aliases
		value: null,
		new: null,
		newValue: null,
		old: null,
		oldValue: null
	};

	const dispatch = (parent, pathOrData, data) => {
		const art = inst.owner[ACTION_RUNTIME_SYM];

		runtime.targetNode = parent;
		runtime.targetRuntime = parent && parent[NODE_RUNTIME_SYM];
		runtime.targetParent = runtime.targetRuntime && runtime.targetRuntime.parent;

		assignState(art, parent, pathOrData, data);
	};

	// Sets state at root level
	runtime.set = (pathOrData, data) => {
		dispatch(
			inst.owner[ACTION_RUNTIME_SYM].root,
			pathOrData,
			data
		);
	};

	// Sets state at node children
	runtime.append = (pathOrData, data) => {
		dispatch(
			getTargetNode(inst),
			pathOrData,
			data
		);
	};

	// Sets state at node parent
	runtime.merge = (pathOrData, data) => {
		const node = getTargetNode(inst),
			parent = node[NODE_RUNTIME_SYM].parent || node;

		dispatch(
			parent,
			pathOrData,
			data
		);
	};

	return runtime;
}

function getTargetNode(inst) {
	return inst.owner[NODE_MANAGER_SYM].nodes[inst.path] || null;
}
