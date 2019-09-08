import {
	isObject,
	resolveArgs,
	getTime
} from "@qtxr/utils";
import { XHRManager } from "./xhr";

// AssetLoader uses predefined processors to format and handle data
// Additionally, temporary processors can be passed in to any
// non-buffer related method call as the last argument
const DEFAULT_PROCESSORS = {
	path: (loader, path) => path,
	prefetchResponse(loader, path, response) {
		if (!response.success)
			console.error(`Failed to prefetch data at ${path}`);

		return response;
	},
	fetchResponse(loader, path, response) {
		if (!response.success)
			console.error(`Failed to fetch data at ${path}`);

		return response;
	},
	xhrSettings: (loader, path, settings) => settings || {},
	dependencies: (loader, path, dependent) => dependent.payload.dependencies,
	assetNode: (loader, path, node, dependent) => node
};

const fetchParams = [
	{ name: "path", type: "string", required: true },
	{ name: "settings", type: Object, default: null },
	{ name: "lazy", type: "boolean", default: true },
	{ name: "processors", type: Object, default: null }
];

const isParams = [
	{ name: "keys", type: a => !isObject(a), coalesce: true },
	{ name: "processors", type: Object, default: null }
];

export default class AssetLoader {
	constructor(processors, manager) {
		this.asyncBufferActive = false;
		this.bufferQueues = {
			prefetch: [],
			fetch: []
		};
		this.assets = [];
		this.assetsMap = {};
		this.xhrManager = manager || new XHRManager();
		this.processors = Object.assign({}, DEFAULT_PROCESSORS, processors);
		this.track = {
			requested: {},
			enqueued: {},
			successful: {},
			failed: {}
		};
	}

	prefetch(...args) {
		let {
			path,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		path = this.process("path", processors, path)();

		this._logPath(path);

		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"prefetch",
				this.prefetch.bind(this),
				args
			);
		}

		const prefetch = new Promise(resolve => {
			this._fetch(path, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("prefetchResponse", processors, path)(response)
					);
					this.resumeAsync();
				});
		});

		this.asyncBufferActive = true;
		return prefetch;
	}

	fetch(...args) {
		let {
			path,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		path = this.process("path", processors, path)();

		this._logPath(path);

		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"fetch",
				this.fetch.bind(this),
				args
			);
		}

		return new Promise(resolve => {
			this._fetch(path, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("fetchResponse", processors, path)(response)
					);
				});
		});
	}

	async fetchModule(...args) {
		let {
			path,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		path = this.process("path", processors, path)();

		this._logPath(path);

		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"fetch",
				this.fetchModule.bind(this),
				args
			);
		}

		const flatTreeMap = {};
		let cached = true;

		const fetch = async p => {
			p = this.process("path", processors, p)();

			const response = await this.fetch(p, settings, lazy, processors);
			if (!response.success)
				return null;

			// If one asset is uncached, the entire tree is considered to be uncached
			cached = cached && response.cached;

			const dependent = response.payload,
				node = mkAssetNode(this, p, dependent, processors);

			flatTreeMap[p] = node;

			const dependencies = this.process("dependencies", processors, p)(response);

			if (!Array.isArray(dependencies))
				return node;

			for (let i = 0, l = dependencies.length; i < l; i++) {
				if (typeof dependencies[i] != "string") {
					console.warn("Invalid dependency (not string):", dependencies[i]);
					continue;
				}

				const dependencyName = this.process("path", processors, dependencies[i])();

				if (flatTreeMap.hasOwnProperty(dependencyName)) {
					node.dependencies.push(flatTreeMap[dependencyName]);
					continue;
				}

				const dependency = await fetch(dependencyName);

				if (!dependency)
					return null;

				node.dependencies.push(dependency);
			}

			return node;
		};

		const nde = await fetch(path, true, null);

		if (!nde)
			return mkResponseNodeError();

		return mkResponseNodeSuccess(nde, cached);
	}

	_fetch(path, settings = null, lazy = true, processors = null) {
		const xhrSettings = this.process("xhrSettings", processors, path)(settings);

		return new Promise(resolve => {
			if (lazy && this.assetsMap.hasOwnProperty(path)) {
				return resolve(
					mkResponseNodeSuccess(this.assetsMap[path], true)
				);
			}

			this.xhrManager.use(xhrSettings)
				.get(path)
				.success(d => {
					delete this.track.enqueued[path];
					delete this.track.failed[path];
					this.track.successful[path] = true;

					if (!this.assetsMap.hasOwnProperty(path))
						this.assets.push(path);
					this.assetsMap[path] = d;

					resolve(
						mkResponseNodeSuccess(d, false)
					);
				})
				.fail(_ => {
					delete this.track.enqueued[path];
					this.track.failed[path] = true;
					resolve(mkResponseNodeError());
				});
		});
	}

	_logPath(path) {
		this.track.requested[path] = true;
		this.track.enqueued[path] = true;
	}

	requestIdle(callback, ...args) {
		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"fetch",
				function(...args) {
					return Promise.resolve(
						callback.apply(this, ...args)
					);
				},
				args
			);
		}

		return Promise.resolve(callback(...args));
	}

	untilIdle() {
		const startTime = getTime();
		return this.requestIdle(_ => getTime() - startTime);
	}

	isRequested(path, processors) {
		path = this.process("path", processors, path)();
		return this.track.requested.hasOwnProperty(path);
	}

	isEnqueued(path, processors) {
		path = this.process("path", processors, path)();
		return this.track.enqueued.hasOwnProperty(path);
	}

	isSuccessful(path, processors) {
		path = this.process("path", processors, path)();
		return this.track.successful.hasOwnProperty(path);
	}

	isFailed(path, processors) {
		path = this.process("path", processors, path)();
		return this.track.failed.hasOwnProperty(path);
	}

	isAny(path, ...args) {
		const {
			keys,
			processors
		} = resolveArgs(args, isParams);

		path = this.process("path", processors, path)();
		testTracking(path, this.track, keys).some(Boolean);
	}

	isAll(path, ...args) {
		const {
			keys,
			processors
		} = resolveArgs(args, isParams);

		path = this.process("path", processors, path)();
		testTracking(path, this.track, keys).every(Boolean);
	}

	bufferAsync(queue, callback, args = []) {
		if (!this.bufferQueues.hasOwnProperty(queue))
			return console.warn(`${queue} is not a valid buffer partition name`);

		return new Promise(resolve => {
			this.bufferQueues[queue].push({
				args,
				resolve,
				callback
			});
		});
	}

	resumeAsync() {
		const buffer = this.bufferQueues;
		this.asyncBufferActive = false;
		
		if (buffer.prefetch.length) {
			const item = buffer.prefetch.shift();

			item.callback
				.apply(this, item.args)
				.then(item.resolve);
				
			return;
		}

		const fetchBuffer = buffer.fetch;
		buffer.fetch = [];

		for (let i = 0, l = fetchBuffer.length; i < l; i++) {
			fetchBuffer[i].callback
				.apply(this, fetchBuffer[i].args)
				.then(fetchBuffer[i].resolve);
		}
	}

	process(type, processors, path) {
		return (...args) => {
			processors = isObject(processors) ? processors : this.processors;

			const processor = processors[type] || this.processors[type];
			if (typeof processor == "function")
				return processor(this, path, ...args);
	
			return null;
		};
	}

	static traverse(rootNode, callback, tail = false) {
		if (!rootNode || !rootNode.isAssetNode || typeof callback != "function")
			return false;

		const visited = {};

		const traverse = node => {
			if (!tail)
				callback(node, rootNode);

			for (let i = 0, l = node.dependencies.length; i < l; i++) {
				const child = node.dependencies[i];
				if (visited[child.id])
					continue;

				visited[child.id] = true;
				traverse(child);
			}

			if (tail)
				callback(node, rootNode);
		};

		traverse(rootNode);

		return true;
	}
}

let assetNodeId = 0;

function mkAssetNode(loader, path, dependent, processors) {
	const node = {
		item: dependent,
		dependencies: [],
		locale: null,
		name: null,
		path: path,
		// Internal data; do not modify
		isAssetNode: true,
		id: assetNodeId++
	};

	loader.process("assetNode", processors, path)(node, dependent);

	return node;
}

function mkResponseNodeError() {
	return {
		payload: null,
		cached: false,
		success: false,
		// Internal data; do not modify
		isResponseNode: true
	};
}

function mkResponseNodeSuccess(payload, cached) {
	return {
		payload,
		cached,
		success: true,
		// Internal data; do not modify
		isResponseNode: true
	};
}

function testTracking(path, trackers, keys) {
	const result = [];

	for (let i = keys.length - 1; i >= 0; i--) {
		const key = typeof keys[i] == "string" ? keys[i].toLowerCase() : null;

		if (!trackers.hasOwnProperty(key))
			continue;

		result.push(trackers[key].hasOwnProperty(path));
	} 

	return result;
}
