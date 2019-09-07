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
	fileName: (loader, fileName) => fileName,
	prefetchResponse(loader, fileName, response) {
		if (!response.success)
			console.error(`Failed to prefetch data at ${fileName}`);

		return response;
	},
	fetchResponse(loader, fileName, response) {
		if (!response.success)
			console.error(`Failed to fetch data at ${fileName}`);

		return response;
	},
	xhrSettings: (loader, fileName, settings) => settings || {},
	dependencies: (loader, fileName, dependent) => dependent.payload.dependencies,
	assetNode: (loader, fileName, node, dependent) => node
};

const fetchParams = [
	{ name: "fileName", type: "string", required: true },
	{ name: "settings", type: Object, default: null },
	{ name: "lazy", type: "boolean", default: true },
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
	}

	prefetch(...args) {
		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"prefetch",
				this.prefetch.bind(this),
				args
			);
		}

		let {
			fileName,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		fileName = this.process("fileName", processors, fileName)();

		const prefetch = new Promise(resolve => {
			this._fetch(fileName, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("prefetchResponse", processors, fileName)(response)
					);
					this.resumeAsync();
				});
		});

		this.asyncBufferActive = true;
		return prefetch;
	}

	fetch(...args) {
		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"fetch",
				this.fetch.bind(this),
				args
			);
		}

		let {
			fileName,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		fileName = this.process("fileName", processors, fileName)();

		return new Promise(resolve => {
			this._fetch(fileName, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("fetchResponse", processors, fileName)(response)
					);
				});
		});
	}

	async fetchModule(...args) {
		if (this.asyncBufferActive) {
			return this.bufferAsync(
				"fetch",
				this.fetchModule.bind(this),
				args
			);
		}

		const {
			fileName,
			settings,
			lazy,
			processors
		} = resolveArgs(args, fetchParams, "allowSingleSource");

		const flatTreeMap = {};
		let cached = true;

		const fetch = async name => {
			name = this.process("fileName", processors, name)();

			const response = await this.fetch(name, settings, lazy, processors);
			if (!response.success)
				return null;

			// If one asset is uncached, the entire tree is considered to be uncached
			cached = cached && response.cached;

			const dependent = response.payload,
				node = mkAssetNode(this, name, dependent, processors);

			flatTreeMap[name] = node;

			const dependencies = this.process("dependencies", processors, name)(response);

			if (!Array.isArray(dependencies))
				return node;

			for (let i = 0, l = dependencies.length; i < l; i++) {
				if (typeof dependencies[i] != "string") {
					console.warn("Invalid dependency (not string):", dependencies[i]);
					continue;
				}

				const dependencyName = this.process("fileName", processors, dependencies[i])();

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

		const nde = await fetch(fileName, true, null);

		if (!nde)
			return responseNodeError();

		return responseNodeSuccess(nde, cached);
	}

	_fetch(fileName, settings = null, lazy = true, processors = null) {
		const xhrSettings = this.process("xhrSettings", processors, fileName)(settings);

		return new Promise(resolve => {
			if (lazy && this.assetsMap.hasOwnProperty(fileName)) {
				return resolve(
					responseNodeSuccess(this.assetsMap[fileName], true)
				);
			}

			this.xhrManager.use(xhrSettings)
				.get(fileName)
				.success(d => {
					if (!this.assetsMap.hasOwnProperty(fileName))
						this.assets.push(fileName);
					this.assetsMap[fileName] = d;

					resolve(
						responseNodeSuccess(d, false)
					);
				})
				.fail(_ => resolve(
					responseNodeError()
				));
		});
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

	process(type, processors, fileName) {
		return (...args) => {
			processors = isObject(processors) ? processors : this.processors;

			const processor = processors[type] || this.processors[type];
			if (typeof processor == "function")
				return processor(this, fileName, ...args);
	
			return null;
		};
	}

	static traverse(rootNode, callback) {
		if (!rootNode || !rootNode.isAssetNode || typeof callback != "function")
			return false;

		const visited = {};

		const traverse = node => {
			callback(node, rootNode);

			for (let i = 0, l = node.dependencies.length; i < l; i++) {
				const child = node.dependencies[i];
				if (visited[child.id])
					continue;

				visited[child.id] = true;
				traverse(child);
			}
		};

		return true;
	}
}

let assetNodeId = 0;

function mkAssetNode(loader, fileName, dependent, processors) {
	const node = {
		item: dependent,
		dependencies: [],
		locale: null,
		name: null,
		fileName: fileName,
		// Internal data; do not modify
		isAssetNode: true,
		id: assetNodeId++
	};

	loader.process("assetNode", processors, fileName)(node, dependent);

	return node;
}

function responseNodeError() {
	return {
		payload: null,
		cached: false,
		success: false,
		// Internal data; do not modify
		isResponseNode: true
	};
}

function responseNodeSuccess(payload, cached) {
	return {
		payload,
		cached,
		success: false,
		// Internal data; do not modify
		isResponseNode: true
	};
}
