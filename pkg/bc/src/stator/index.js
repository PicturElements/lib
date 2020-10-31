import {
	isObject,
	getCompactObjectLeaves,
	composeOptionsTemplates
} from "@qtxr/utils";

import { Manage } from "../common";
import Hookable from "../hookable";

import {
	TRANSFORMS_SYM,
	NODE_MANAGER_SYM,
	ACTION_RUNTIME_SYM,
	toPath
} from "./common";
import NodeManager from "./node-manager";
import {
	StatorObjectNode,
	initNode,
	assignState
} from "./nodes";
import Transform from "./transform";

export default class Stator extends Hookable {
	constructor(options) {
		super(options);
		Manage.instantiate(Stator, this, options);
	}

	[Manage.CONSTRUCTOR](opt) {
		const art = initAction({
			stator: this,
			root: null,
			nodeManager: null,
			actionId: -1,
			changes: [],
			flags: {
				bubble: opt("bubble", false),
				expandObjects: opt("expandObjects", false),
				recursiveDelete: opt("recursiveDelete", false),
				preserveOldState: opt("preserveOldState", false),
				track: {
					add: opt("track.additions", false),
					update: opt("track.updates", false),
					delete: opt("track.deletions", false)
				},
				trackAny: null
			}
		});

		this[NODE_MANAGER_SYM] = new NodeManager(this);
		this[ACTION_RUNTIME_SYM] = art;
		this[TRANSFORMS_SYM] = {};

		art.nodeManager = this[NODE_MANAGER_SYM];
		art.flags.trackAny = art.flags.track.add || art.flags.track.update || art.flags.track.delete;

		if (opt("selfStore")) {
			initNode(art, this, {
				stator: this,
				parent: null,
				key: "",
				value: {},
				store: {}
			});
			this[ACTION_RUNTIME_SYM].root = this;
		} else {
			this.state = new StatorObjectNode(
				art,
				null,
				"",
				{}
			);
			this[ACTION_RUNTIME_SYM].root = this.state;
		}

		const initState = opt("state");
		if (initState)
			this.setState(initState);
	}

	setState(accessorOrState, state) {
		const store = Stator.opt(this, "selfStore") ?
			this :
			this.state;

		const art = initAction(this[ACTION_RUNTIME_SYM]);

		if (art.flags.trackAny)
			art.changes = [];

		assignState(art, store, accessorOrState, state);

		return art.flags.trackAny ?
			art.changes :
			this;
	}

	addTransform(path, handler) {
		return mountTransform(this, toPath(path), handler);
	}

	addTransforms(handlers) {
		if (!isObject(handlers))
			throw new TypeError("Failed to add transforms: provided handlers must be an object");

		const transforms = {};

		getCompactObjectLeaves(handlers, d => {
			const path = toPath(d.path);
			transforms[path] = mountTransform(this, path, d.value);
		});

		return transforms;
	}

	hook(partitionName, ...args) {
		super.hook(
			toPath(partitionName),
			...args
		);
	}

	hookNS(namespace, partitionName, ...args) {
		super.hookNS(
			namespace,
			toPath(partitionName),
			...args
		);
	}

	unhook(partitionName, ...args) {
		super.unhook(
			toPath(partitionName),
			...args
		);
	}

	unhookNS(namespace, partitionName, ...args) {
		super.unhookNS(
			namespace,
			toPath(partitionName),
			...args
		);
	}
}

function initAction(art) {
	art.actionId++;
	return art;
}

function mountTransform(inst, path, handler) {
	if (typeof path != "string")
		throw new TypeError("Failed to add transform: path must be a string");
	if (typeof handler != "function")
		throw new TypeError(`Failed to add transform: handler must be a function (at '${path}')`);

	const transform = new Transform(inst, path, handler);
	inst[TRANSFORMS_SYM][path] = transform;
	return transform;
}

Manage.declare(Stator, {
	name: "Stator",
	namespace: "stator",
	extends: Hookable,
	proto: ["setState", "addTransform", "addTransforms"],
	static: [],
	optionsTemplates: composeOptionsTemplates({
		selfStore: true,
		bubble: true,
		expandObjects: true,
		preserveOldState: true,
		recursiveDelete: true,
		trackAdditions: {
			track: {
				additions: true
			}
		},
		trackUpdates: {
			track: {
				updates: true
			}
		},
		trackDeletions: {
			track: {
				deletions: true
			}
		},
		trackAll: {
			track: {
				additions: true,
				updates: true,
				deletions: true
			}
		}
	})
});
