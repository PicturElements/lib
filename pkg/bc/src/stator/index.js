import {
	isObject,
	normalizePath,
	getCompactObjectLeaves,
	composeOptionsTemplates
} from "@qtxr/utils";

import { Manage } from "../common";
import Hookable from "../hookable";

import {
	TRANSFORMS_SYM,
	NODE_MANAGER_SYM,
	ACTION_RUNTIME_SYM
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
			flags: {
				bubble: opt("bubble", false),
				expandObjects: opt("expandObjects", false),
				deferTransforms: opt("deferTransforms", false),
				recursiveDelete: opt("recursiveDelete", false),
				preserveOldState: opt("preserveOldState", false),
				track: {
					add: opt("track.additions", false),
					update: opt("track.updates", false),
					delete: opt("track.deletions", false)
				},
				trackAny: null
			},
			// Mutable data
			actionId: -1,
			changes: [],
			pendingTransforms: [],
			visitedTransforms: {}
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

	hook(...args) {
		const a = this.resolveHookArgs("hook", args);
		a.partitionName = toPath(a.partitionName);
		return super.hook(a);
	}

	hookNS(...args) {
		const a = this.resolveHookArgs("hookNS", args);
		a.partitionName = toPath(a.partitionName);
		return super.hookNS(a);
	}

	unhook(...args) {
		const a = this.resolveHookArgs("unhook", args);
		a.partitionName = toPath(a.partitionName);
		return super.unhook(a);
	}

	unhookNS(...args) {
		const a = this.resolveHookArgs("unhookNS", args);
		a.partitionName = toPath(a.partitionName);
		return super.unhookNS(a);
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

function toPath(partitionName) {
	const ex = /(?:(\w+):)?(.+)/.exec(partitionName);
	if (!ex)
		return null;

	const normalized = normalizePath.with({ split: "glob", join: "url" })(ex[2]);

	if (ex[1])
		return `${ex[1]}:${normalized}`;

	return normalized;
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
		deferTransforms: true,
		recursiveDelete: true,
		preserveOldState: true,
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
