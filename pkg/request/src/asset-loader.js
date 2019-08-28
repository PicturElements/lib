import {
	clone,
	isObject,
	resolveArgs
} from "@qtxr/utils";
import { XHRManager } from "./xhr";

// AssetLoader uses predefined processors to format and handle data
// Additionally, temporary processors can be passed in to any
// non-buffer related method call as the last argument
const DEFAULT_PROCESSORS = {
	fileName: (loader, fileName) => fileName,
	prefetchResponse(loader, response, fileName) {
		if (!response)
			console.error(`Failed to prefetch data at ${fileName}`);

		return response;
	},
	fetchResponse(loader, response, fileName) {
		if (!response)
			console.error(`Failed to fetch data at ${fileName}`);

		return response;
	},
	xhrSettings: (loader, settings, fileName) => settings || {},
	dependencies: (loader, dependent, fileName) => dependent.dependencies,
	assetNode: (loader, node, dependent, fileName) => node
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
		this.bufferedAsync = {
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
				this.bufferedAsync.prefetch,
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

		fileName = this.process("fileName", processors, fileName);

		const prefetch = new Promise(resolve => {
			this._fetch(fileName, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("prefetchResponse", processors, response, fileName)
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
				this.bufferedAsync.fetch,
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

		fileName = this.process("fileName", processors, fileName);

		return new Promise(resolve => {
			this._fetch(fileName, settings, lazy, processors)
				.then(response => {
					resolve(
						this.process("fetchResponse", processors, response, fileName)
					);
				});
		});
	}

	_fetch(fileName, settings = null, lazy = true, processors = null) {
		const xhrSettings = this.process("xhrSettings", processors, settings, fileName);

		return new Promise(resolve => {
			if (lazy && this.assetsMap.hasOwnProperty(fileName))
				return resolve(this.assetsMap[fileName]);

			this.xhrManager.use(xhrSettings)
				.get(fileName)
				.success(d => {
					if (!this.assetsMap.hasOwnProperty(fileName))
						this.assets.push(fileName);
					this.assetsMap[fileName] = d;

					resolve(d);
				})
				.fail(_ => resolve(null));
		});
	}

	async fetchModule(...args) {
		if (this.asyncBufferActive) {
			return this.bufferAsync(
				this.bufferedAsync.fetch,
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

		const fetch = async (name, dependencyTree = null) => {
			name = this.process("fileName", processors, name);

			const dependent = await this.fetch(name, settings, lazy, processors);
			if (!dependent)
				return null;

			const node = mkAssetNode(this, name, dependent, processors);

			if (dependencyTree)
				dependencyTree.push(node);
			flatTreeMap[name] = node;

			const dependencies = this.process("dependencies", processors, dependent, fileName);

			if (!Array.isArray(dependencies))
				return node;

			for (let i = 0, l = dependencies.length; i < l; i++) {
				const dependencyName = dependencies[i];

				if (flatTreeMap.hasOwnProperty(dependencyName))
					continue;

				await fetch(dependencyName, node.dependencies);
			}

			return node;
		};

		return await fetch(fileName);
	}

	bufferAsync(bufferPartition, callback, args = []) {
		args = Array.isArray(args) ? [].slice.call(args) : args;

		return new Promise(resolve => {
			bufferPartition.push({
				args: clone(args),
				resolve,
				callback
			});
		});
	}

	resumeAsync() {
		const buffer = this.bufferedAsync;
		this.asyncBufferActive = false;
		
		if (buffer.prefetch.length) {
			const item = buffer.prefetch.shift();
			item.callback(...item.args).then(d => item.resolve(d));
			return;
		}

		const fetchBuffer = buffer.fetch;
		buffer.fetch = [];
		for (let i = 0, l = fetchBuffer.length; i < l; i++)
			fetchBuffer[i].callback(...fetchBuffer[i].args).then(d => fetchBuffer[i].resolve(d));
	}

	process(type, processors, ...args) {
		processors = isObject(processors) ? processors : this.processors;

		const processor = processors[type] || this.processors[type];
		if (typeof processor == "function")
			return processor(this, ...args);

		return null;
	}
}

function mkAssetNode(loader, fileName, dependent, processors) {
	const node = {
		item: dependent,
		dependencies: [],
		locale: null,
		name: null,
		fileName: fileName,
		isAssetNode: true
	};

	loader.process("assetNode", processors, node, dependent, fileName);

	return node;
}
