import {
	sym,
	get,
	clone,
	inject,
	isObject,
	serialize,
	isPrimitive,
	matchType,
	partition,
	resolveVal,
	resolveArgs,
	mkProcessor,
	requestFrame,
	extendProcessorOptions,
	composePresets,
	addPreset,
	mergePresets
} from "@qtxr/utils";
import { XHRManager } from "@qtxr/request";
import { Hookable } from "@qtxr/bc";

const DEFAULT_STATE_PRESETS = {
	loaded: {
		loaded: true,
		loading: false,
		error: false,
		errorMsg: ""
	},
	loading: {
		loaded: false,
		loading: true
	},
	error: {
		loaded: false,
		loading: false,
		error: true,
		errorMsg: "Unspecified error"
	}
};

const DEFAULT_METHOD = "custom";
const PASSIVE_IGNORE = {
	method: true,
	fetch: true
};

const COMMON_PROCESSOR_OPTIONS = {
	processors: {
		validate: ({ cell }, wrappedResponse, errorMsg) => {
			return wrappedResponse.success && wrappedResponse.payload ?
				null :
				getErrorMsg(cell, wrappedResponse, errorMsg);
		},
		success: (a, wrappedResponse) => wrappedResponse,
		fail: (a, wrappedResponse) => wrappedResponse,
		data: (a, data) => data,
		runtime: ({ runtime }) => runtime
	},
	transformers: {
		validate(proc) {
			if (typeof proc == "string") {
				const [ accessor, errorMsg ] = proc.trim().split(/\s*:\s*/);
	
				return ({ cell }, wrappedResponse) => {
					if (get(wrappedResponse, accessor) && wrappedResponse.success)
						return null;
	
					return getErrorMsg(cell, wrappedResponse, errorMsg);
				};
			} else if (Array.isArray(proc)) {
				const [ accessor, value, errorMsg ] = proc;
	
				return ({ cell }, wrappedResponse) => {
					if (get(wrappedResponse, accessor) == value && wrappedResponse.success)
						return null;
	
					return getErrorMsg(cell, wrappedResponse, errorMsg);
				};
			} else if (isObject(proc)) {
				let {
					matches,
					value,
					errorMsg,
					errorMsgPath
				} = proc;
	
				return ({ cell }, wrappedResponse) => {
					let match = true;
	
					if (Array.isArray(matches)) {
						const [ accessor, value, errMsg ] = matches;
	
						if (errMsg)
							errorMsg = errMsg;
	
						match = get(wrappedResponse, accessor) == value;
					} else if (typeof matches == "string") {
						if (value !== undefined)
							match = get(wrappedResponse, matches) == value;
						else
							match = Boolean(get(wrappedResponse, matches));
					} else if (typeof matches == "function")
						match = Boolean(matches(cell.args, wrappedResponse));
	
					if (match && wrappedResponse.success)
						return null;
	
					if (typeof errorMsgPath == "string")
						return getErrorMsg(cell, wrappedResponse, get(wrappedResponse, errorMsgPath));
	
					return getErrorMsg(cell, wrappedResponse, errorMsg);
				};
			}
	
			return proc;
		},
		data(proc) {
			if (typeof proc == "string" || Array.isArray(proc)) {
				return (a, data) => {
					return get(data, proc);
				};
			}
	
			return proc;
		},
		key(proc) {
			let keyer;

			switch (typeof proc) {
				case "string":
					keyer = (a, item) => get(item, proc);
					break;

				case "function":
					keyer = proc;
					break;

				default:
					return null;
			}

			return ({ cell, runtime }, item) => {
				const key = keyer(cell, runtime, item);

				if (!isPrimitive(key))
					console.warn("Suboptimal key: key value is not primitive");
				else if (key == null)
					console.warn("Suboptimal key: key is null or undefined");

				return key;
			};
		},
		preset(proc) {
			if (typeof proc != "function")
				return _ => proc;

			return proc;
		}
	}
};

const DEFAULT_PROCESSOR_OPTIONS = {
	get: inject({
		processors: {},
		transformers: {}
	}, COMMON_PROCESSOR_OPTIONS),
	post: inject({
		processors: {},
		transformers: {}
	}, COMMON_PROCESSOR_OPTIONS),
	custom: inject({
		processors: {},
		transformers: {}
	}, COMMON_PROCESSOR_OPTIONS),
};

const DEFAULT_WATCHER_TASK_DISPATCHERS = {
	fetch({ cell }, changes) {
		return cell._fetch({
			changes
		});
	}
};

const DEFAULT_PARTITION_CLASSIFIER = {
	// XHR preset
	url: "xhrPreset",
	baseUrl: "xhrPreset",
	// Irrelevant data
	type: "garbage",
	species: "garbage",
	persistent: "garbage"
};

const GET_ARGS = [
	{ name: "accessor", type: "string|Array", default: "" },
	{ name: "default", type: "any", default: null },
	{ name: "fetchAnew", type: "boolean", default: false }
];

export default class DataCell extends Hookable {
	constructor(config = {}, initConfig = {}) {
		super({
			hookable: {
				noOwnerArg: true
			}
		});

		config = mergePresets(config, DataCell.presets, {
			defaultKey: "default",
			keys: ["preset", "presets"],
			injectConfig: config.passive ?
				PASSIVE_IGNORE :
				null
		});

		const classifier = inject(
			DEFAULT_PARTITION_CLASSIFIER,
			initConfig.partitionClassifier,
			"cloneTarget|override"
		);

		const {
			newConfig,
			processors,
			xhrPreset
		} = partition(config, {
			newConfig: {},
			processors: {},
			xhrPreset: {},
			instance: this
		}, (val, k) => {
			return k[0] == "$" ? "processors" : classifier[k];
		}, "newConfig");

		// Remove "$" from root level processor keys
		for (const k in processors) {
			if (processors.hasOwnProperty(k) && k[0] == "$") {
				processors[k.substr(1)] = processors[k];
				delete processors[k];
			}
		}

		this.state = inject({
			loaded: false,
			loading: false,
			error: false,
			errorMsg: "",
			fetches: 0
		}, initConfig.defaultState, "override");

		this.data = null;

		this.xhrManager = newConfig.xhrManager || new XHRManager();
		this.xhrPreset = [inject(xhrPreset, newConfig.xhrPreset)];
		if (newConfig.xhrPreset)
			this.xhrPreset.push(newConfig.xhrPreset);

		this.fetcher = this.mkFetcherObject(newConfig);
		this.stateTransforms = inject(
			newConfig.stateTransforms,
			initConfig.stateTransforms,
			"cloneTarget"
		);
		this.statePresets = Object.assign(
			DEFAULT_STATE_PRESETS,
			initConfig.statePresets,
			newConfig.statePresets
		);
	
		this.watchTaskDispatchers = Object.assign(
			{},
			DEFAULT_WATCHER_TASK_DISPATCHERS,
			initConfig.watchTaskDispatchers,
			newConfig.watchTaskDispatchers
		);

		this.watcher = this.mkWatcherObject(newConfig.watch);

		// The base runtime. External code may inject data
		// here. Third party code may mutate this
		this.baseRuntime = {
			cell: this
		};
		// The default runtime given at initialization
		this.defaultRuntime = newConfig.runtime;
		// Pending runtime. This value is meant to be
		// mutated during program execution
		this.pendingRuntime = null;

		// Processor / handler arguments. This object contains references
		// and runtime data that is passed as the first argument to processors,
		// handlers, callbacks, and hooks. This object may be mutated at any point,
		// but that is primarily reserved for internal use
		this.args = {
			cell: this,
			runtime: {}
		};

		// Save partitioned data for external reference
		this.processors = processors;
		this.config = newConfig;
		this.initConfig = initConfig;
		this.inheritableConfig = mkInheritableConfig(newConfig, initConfig);

		const defaultProcessorOptions = extendProcessorOptions(
			DEFAULT_PROCESSOR_OPTIONS[this.fetcher.method],
			initConfig.processorOptions,
			"cloneTarget|override"
		);

		this.process = mkProcessor(
			extendProcessorOptions(
				defaultProcessorOptions,
				{
					processors: Object.assign({}, processors, newConfig.processors),
					transformers: newConfig.transformers
				},
				"cloneTarget|override"
			),
			this.args
		);

		// Don't run this on derived classes
		// as they will want to run this at the end of their creation,
		// and might need to finish init manually
		if (this.constructor == DataCell)
			this.finishInit(initConfig);
	}

	finishInit(initConfig) {
		if (!initConfig.preventHooking)
			this.hookAll(this.config.hooks);
		if (!initConfig.preventDataSet)
			this.setData(this.config.data);
		if (!initConfig.preventStateSet)
			this.setState(this.config.state);

		if (typeof get(initConfig, "on.created") == "function")
			initConfig.on.created(this.args);

		if (!initConfig.preventAutoFetch && this.config.autoFetch)
			this.fetch();
	}

	callHooks(partitionName, ...args) {
		return super.callHooks(partitionName, this.args, ...args);
	}

	setData(data) {
		this.data = data;
		this.callHooks("setData", data);
	}

	with(...runtimes) {
		this.pendingRuntime = this.pendingRuntime || clone(
			resolveVal(this.defaultRuntime, this, {})
		) || {};

		this.args.runtime = this.pendingRuntime;

		for (let i = 0, l = runtimes.length; i < l; i++) {
			const runtime = resolveVal(
				runtimes[i],
				this.args
			);

			inject(this.pendingRuntime, runtime, "override");
		}

		return this;
	}

	use(...runtimes) {
		return this.with(...runtimes);
	}

	fetch(...args) {
		return this._fetch({}, ...args);
	}

	_fetch(runtime, ...args) {
		if (this.state.loading) {
			return new Promise(resolve => {
				this.hook("fetched", (a, response) => resolve(response), 1);
			});
		}

		const fetcher = this.fetcher,
			doFetch = async _ => {
				this.args.runtime = runtime;
				this.setState("loading");
				this.callHooks("loading");

				this.baseRuntime.state = this.state;

				if (this.defaultRuntime)
					runtime = inject(this.defaultRuntime, runtime, "cloneTarget");
				if (this.pendingRuntime)
					runtime = inject(this.pendingRuntime, runtime);
	
				runtime = inject(runtime, this.baseRuntime);
	
				this.args.runtime = runtime;
				runtime = this.process("runtime")(runtime) || runtime;
				this.args.runtime = runtime;
				this.pendingRuntime = null;
	
				const response = await fetcher.fetch(this.args, ...args);

				if (!response.isDataCellResponse) {
					this.setState("loaded");
					let data = this.process("data")(response);
					this.setData(data);
					this.callHooks("success", response);
				} else if (response.success) {
					this.setState("loaded");
					response.processedData = this.process("data")(response.payload);
					response.runtime = runtime;
					this.setData(response.processedData);
					this.callHooks("success", response);
				} else {
					this.setState("error", {
						errorMsg: response.errorMsg
					});
					response.processedData = null;
					response.runtime = runtime;
					this.callHooks("fail", response);
				}
	
				this.setState({
					fetches: this.state.fetches + 1
				});
				
				fetcher.enqueuedResolvers = [];
				fetcher.deferredFetch = null;
				fetcher.throttledFetch = null;
				this.callHooks("fetched", response);
				return response;
			};

		if (typeof fetcher.throttle == "number") {
			const erLength = fetcher.enqueuedResolvers.length,
				throttledResponse = new Promise(resolve => {
					fetcher.enqueuedResolvers.push(resolve);
				});

			clearTimeout(fetcher.throttledFetch);
			fetcher.throttledFetch = setTimeout(async _ => {
				const er = fetcher.enqueuedResolvers;
				const response = await doFetch();

				for (let i = 0, l = er.length; i < l; i++)
					er[i](response);
			}, fetcher.throttle);

			if (erLength >= this.fetcher.maxThrottles)
				console.warn(`Maximum concurrent throttled fetches reached: ${this.fetcher.maxThrottles}`);
			else
				fetcher.deferredFetch = doFetch;

			return throttledResponse;
		} else if (fetcher.defer) {
			const erLength = fetcher.enqueuedResolvers.length,
				deferredResponse = new Promise(resolve => {
					fetcher.enqueuedResolvers.push(resolve);
				});

			if (erLength >= this.fetcher.maxDefers)
				console.warn(`Maximum concurrent deferred fetches reached: ${this.fetcher.maxDefers}`);
			else
				fetcher.deferredFetch = doFetch;

			if (!erLength) {
				requestFrame(async _ => {
					const er = fetcher.enqueuedResolvers;
					const response = await fetcher.deferredFetch();

					for (let i = 0, l = er.length; i < l; i++)
						er[i](response);
				});
			}

			return deferredResponse;
		} else
			return doFetch();
	}

	async retrieve(...args) {
		if (this.state.loaded)
			return this.data;

		await this.fetch(...args);
		return this.data;
	}

	async retr(fetchAnew, ...args) {
		if (this.state.loaded && !fetchAnew)
			return this.data;

		await this.fetch(...args);
		return this.data;
	}

	get(...args) {
		const a = resolveArgs(args, GET_ARGS, "allowSingleSource");

		return async (...args) => {
			if (!this.state.loaded || a.fetchAnew)
				await this.fetch(...args);

			return get(this.data, a.accessor, a.default);
		};
	}

	query(accessor) {
		return get(this.data, accessor, null);
	}

	setState(...states) {
		let newState = Object.assign({}, this.state);

		for (let i = 0, l = states.length; i < l; i++) {
			let state = states[i];

			if (typeof state == "string")
				state = this.statePresets[state];

			Object.assign(newState, state);
		}

		newState = applyStateTransforms(this, newState);
		return mergeStateAndDispatchChanges(this, newState);
	}
	
	getFetcherMethod(fetcher) {
		if (!isObject(fetcher))
			return null;

		if (typeof fetcher.method == "string")
			return fetcher.method;
		if (fetcher.method == null)
			return DEFAULT_METHOD;

		return null;
	}

	getFetcherCharacteristics(fetcher) {
		const method = this.getFetcherMethod(fetcher),
			characteristics = {
				method,
				hasHandler: true,
				error: null
			};

		if (!method) {
			characteristics.hasHandler = false;
			characteristics.error = "invalid fetch method";
		} else switch (method) {
			case "get":
			case "post":
				break;
			
			case "custom":
				characteristics.hasHandler = typeof (fetcher.fetch || fetcher.handler) == "function";
				if (!characteristics.hasHandler)
					characteristics.error = "no fetcher defined";
				break;

			default:
				characteristics.hasHandler = false;
				characteristics.error = `invalid fetch method '${method}'`;
		}

		return characteristics;
	}

	mkFetcherObject(config) {
		const fetcher = {
			method: null,
			throttle: null,
			defer: true,
			maxDefers: 1,
			deferredFetch: null,
			maxThrottles: Infinity,
			throttledFetch: null,
			enqueuedResolvers: [],
			poll: this.mkPollingObject(config.poll)
		};
	
		if (typeof config == "function") {
			config = {
				fetch: config
			};
		}
	
		if (!isObject(config))
			throw new TypeError("Failed to make fetcher object: fetcher config is invalid");
	
		inject(fetcher, config, {
			schema: {
				method: "string",
				fetch: "function",
				handler: "function",
				defer: "boolean",
				maxDefers: "number",
				throttle: "number",
				maxThrottles: "number"
			},
			override: true
		});
	
		const characteristics = this.getFetcherCharacteristics(fetcher);
	
		if (characteristics.error != null)
			throw new Error(`Failed to make fetcher object: ${characteristics.error}`);
	
		switch (characteristics.method) {
			case "get":
				fetcher.fetch = (a, url = null, preset = null) => {
					return fetchRequest(a, "get", url, preset);
				};
				break;
			
			case "post":
				fetcher.fetch = (a, url = null, preset = null) => {
					return fetchRequest(a, "post", url, preset);
				};
				break;
	
			case "custom": {
				const fetchHandler = config.fetch || config.handler;
	
				fetcher.fetch = (a, ...args) => {
					return fetchCustom(a, fetchHandler, ...args);
				};
				break;
			}
		}
	
		fetcher.method = characteristics.method;
		return fetcher;
	}

	mkPollingObject(config) {
		const poll = {
			interval: 1000,
			iterations: Infinity,
			running: true,
			// Internal fields
			iterationCount: 0,
			lastTimestamp: 0
		};
	
		if (typeof config == "number") {
			poll.interval = config;
			return poll;
		}
	
		if (!isObject(config))
			return null;
	
		inject(poll, config, {
			schema: {
				interval: "number",
				iterations: "number",
				running: "boolean"
			},
			strictSchema: true
		});
	
		return poll;
	}

	mkWatcherObject(watchers) {
		const watcher = {
			dispatchers: {}
		};
	
		if (!watchers)
			return watcher;
	
		if (Array.isArray(watchers)) {
			for (let i = 0, l = watchers.length; i < l; i++) {
				const watch = watchers[i];
	
				// By default, watchers dispatch a fetch
				if (typeof watch == "string")
					watcher.dispatchers[watch] = "fetch";
				else if (isObject(watch) && watch.hasOwnProperty("watch"))
					watcher.dispatchers[watch.watch] = watch;
				else
					throw new TypeError(`Failed to make watcher object (at index ${i}): array watchers must contain a string specifying the watched property, or a dispatcher object with a 'watch' key`);
			}
		} else if (isObject(watchers)) {
			for (const k in watchers) {
				if (!watchers.hasOwnProperty(k))
					continue;
	
				const watch = watchers[k];
	
				if (!matchType(watch, "string|function|Object"))
					throw new TypeError(`Failed to make watcher object (at key '${k}'): properties must be a string refrence to a dispatcher, a dispatcher function, or a dispatcher object`);
			
				watcher.dispatchers[k] = watch;
			}
		} else
			throw new TypeError("Failed to make watcher object: invalid watcher input, must be array or object");
	
		return watcher;
	}

	mkSuccessResponse(payload, config) {
		return Object.assign({
			cell: this,
			payload,
			success: true,
			errorMsg: "",
			// Internal data; do not modify
			isDataCellResponse: true
		}, config);
	}

	mkErrorResponse(errorMsg, config) {
		return Object.assign({
			cell: this,
			payload: null,
			success: false,
			errorMsg,
			// Internal data; do not modify
			isDataCellResponse: true
		}, config);
	}

	getKey(item) {
		if (!item)
			return null;

		return this.process("key")(item);
	}

	getData(item) {
		return item;
	}

	extractData() {
		return this.data;
	}

	getCells() {
		return [this];
	}

	static definePreset(nameOrPreset, preset) {
		let name = nameOrPreset;
	
		if (typeof nameOrPreset != "string") {
			preset = nameOrPreset;
			name = "default";
		}
	
		if (!name || typeof name != "string")
			throw new Error(`Cannot define preset: invalid preset name ${serialize(name)}`);
	
		addPreset(
			this.presets,
			name,
			preset
		);
	}

	static resolveConfig(config) {
		return mergePresets(config, DataCell.presets, {
			keys: ["preset", "presets"],
			injectConfig: config.passive ?
				PASSIVE_IGNORE :
				null
		});
	}
}

DataCell.presets = composePresets({});

function applyStateTransforms(cell, newState) {
	const state = cell.state,
		affected = {};

	for (const k in newState) {
		applyTransform(k, {
			source: k,
			transformed: {}
		});
	}

	function applyTransform(key, transformSession) {
		if (!newState.hasOwnProperty(key) || newState[key] == state[key])
			return;

		if (!cell.stateTransforms.hasOwnProperty(key))
			return;

		affected[key] = true;

		const untransformedState = Object.assign({}, newState),
			transformedState = cell.stateTransforms[key]({
				value: newState[key],
				oldValue: state[key],
				state,
				newState,
				key
			});

		newState = isObject(transformedState) ?
			transformedState :
			newState;

		for (const k in newState) {
			if (!newState.hasOwnProperty(k) || k == key)
				continue;

			if (affected.hasOwnProperty(k)) {
				if (transformSession.transformed[k])
					console.error(`Attempted to transform '${k}' again, after already being transformed. Origin at '${transformSession.source}', coming from '${key}'`);
				
				newState[k] = untransformedState[k];
			} else if (newState[k] != untransformedState[k]) {
				transformSession.transformed[k] = true;
				applyTransform(k, transformSession);
			}
		}
	}

	return newState;
}

function mergeStateAndDispatchChanges(cell, newState) {
	const state = cell.state,
		changes = [];
	let changed = false;

	for (const k in newState) {
		if (!newState.hasOwnProperty(k) || state[k] == newState[k])
			continue;

		if (!changed) {
			cell.callHooks("stateUpdate", newState, state);
			changed = true;
		}

		cell.callHooks(`stateUpdate:${k}`, newState[k], state[k]);
		changes.push({
			property: k,
			old: state[k],
			new: newState[k]
		});

		state[k] = newState[k];
	}

	dispatchChanges(cell, changes);
	return changes;
}

function dispatchChanges(cell, changes) {
	const dispatchers = cell.watcher.dispatchers,
		batchKey = sym("task batch"),
		tasks = [];

	for (let i = 0, l = changes.length; i < l; i++) {
		const change = changes[i];

		if (!dispatchers.hasOwnProperty(change.property) && !dispatchers.hasOwnProperty("any"))
			continue;

		let dispatcher = resolveDispatcher(dispatchers[change.property] || dispatchers.any);

		if (typeof dispatcher == "function") {
			if (dispatcher.hasOwnProperty(batchKey))
				tasks[dispatcher[batchKey]].changes.push(change);
			else {
				dispatcher[batchKey] = tasks.length;
				tasks.push({
					dispatch: dispatcher,
					changes: [change]
				});
			}
		} else
			throw new Error(`Failed to dispatch changes: '${change.property}' does not have a valid dispatcher`);
	}

	for (let i = 0, l = tasks.length; i < l; i++) {
		delete tasks[i].dispatch[batchKey];
		tasks[i].dispatch(cell.args, tasks[i].changes);
	}

	function resolveDispatcher(dispatcher) {
		switch (typeof dispatcher) {
			case "string":
				if (dispatcher[0] == ".")
					return resolveDispatcher(dispatchers[dispatcher.substr(1)]);
				
				return cell.watchTaskDispatchers[dispatcher];

			case "function":
				return dispatcher;

			case "object":
				if (dispatcher == null)
					return null;

				return dispatcher.dispatch;
		} 
	}
}

function fetchRequest(a, method = "get", url = null, preset = null) {
	method = method.toLowerCase();
	
	if (typeof url != "string") {
		preset = {
			payload: url
		};
		url = null;
	}

	const {
		cell,
		runtime
	} = a;

	return new Promise(resolve => {
		const runtimePreset = cell.process("preset")(runtime.preset);

		cell.xhrManager
			.use(cell.xhrPreset, runtimePreset, preset)
			[method](url)
			.success((response, xhr, xhrState) => {
				let successResponse = cell.mkSuccessResponse(response, {
					status: xhr.status,
					xhr,
					xhrState
				});

				const validation = validate(cell, successResponse);

				if (!validation) {
					successResponse = cell.process("success")(successResponse);
					resolve(successResponse);
				} else {
					let failResponse = cell.mkErrorResponse(validation, {
						status: 0,
						xhr,
						xhrState
					});

					failResponse = cell.process("fail")(failResponse);
					resolve(failResponse);
				}
			})
			.fail((payloadOrStatus, xhr, xhrState) => {
				const payload = (typeof payloadOrStatus != "number") ?
					payloadOrStatus :
					null;
				
				let failResponse = cell.mkErrorResponse("Unknown Error", {
					payload,
					status: xhr.status,
					xhr,
					xhrState
				});

				failResponse = cell.process("fail")(failResponse);
				const validation = validate(cell, failResponse);
				failResponse.errorMsg = validation;
				resolve(failResponse);
			});
	});
}

async function fetchCustom(a, handler, ...args) {
	const { cell } = a;

	try {
		const response = await handler(a, ...args);
		let wrappedResponse = response && response.isDataCellResponse ? 
			response : (
				response === null && !cell.config.errorOnReject ?
					cell.mkErrorResponse(response) :
					cell.mkSuccessResponse(response)
			);

		const validation = validate(cell, wrappedResponse);

		if (validation == null)
			return cell.process("success")(wrappedResponse);

		const failResponse = cell.mkErrorResponse(validation);
		return cell.process("fail")(failResponse);
	} catch (e) {
		let failResponse = cell.mkErrorResponse("Unknown Error", {
			payload: null
		});

		failResponse = cell.process("fail")(failResponse);
		const validation = validate(cell, failResponse, e.message);
		failResponse.errorMsg = validation;
		return failResponse;
	}
}

function validate(cell, data, errorMsg) {
	const validation = cell.process("validate")(data, errorMsg);
	return typeof validation == "string" ? validation : null;
}

function getErrorMsg(cell, wrappedResponse, errorMsg) {
	errorMsg = typeof errorMsg == "function" ?
		errorMsg(cell.args, wrappedResponse) :
		errorMsg;

	if (errorMsg)
		return errorMsg;

	switch (cell.fetcher.method) {
		case "get":
			return (wrappedResponse.status >= 400 ?
				`GET Request Error (status: ${wrappedResponse.status})` :
				"GET Request Error"
			);
		
		case "post":
			return (wrappedResponse.status >= 400 ?
				`POST Request Error (status: ${wrappedResponse.status})` :
				"POST Request Error"
			);

		default:
			return `Unknown error (method: '${cell.fetcher.method}')`;
	}
}

function mkInheritableConfig(config, initConfig) {
	return {
		config: inject({}, config, {
			schema: {},
			typed: true,
			deep: true,
			strictSchema: true
		}),
		initConfig: inject({}, initConfig, {
			schema: {
				on: "object"
			},
			typed: true,
			deep: true,
			strictSchema: true
		})
	};
}
