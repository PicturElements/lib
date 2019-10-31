import {
	get,
	casing,
	clone,
	inject,
	isObject,
	partition,
	resolveVal,
	mkProcessor,
	requestFrame,
	extendProcessorOptions
} from "@qtxr/utils";
import { XHRManager } from "@qtxr/request";
import { Hookable } from "@qtxr/bc";

const STATE_PRESETS = {
	loaded: {
		loaded: true,
		loading: false,
		error: false,
		errorMsg: ""
	},
	loading: {
		loaded: false,
		loading: true,
		error: false,
		errorMsg: ""
	},
	error: {
		loaded: false,
		loading: false,
		error: true,
		errorMsg: "Unspecified error"
	}
};

const PROCESSOR_TRANSFORMERS = {
	validate(proc) {
		if (typeof proc == "string") {
			const [ accessor, errorMsg ] = proc.trim().split(/\s*:\s*/);

			return (cell, runtime, wrappedResponse) => {
				if (get(wrappedResponse, accessor) && wrappedResponse.success)
					return null;

				return getErrorMsg(cell, wrappedResponse, errorMsg);
			};
		} else if (Array.isArray(proc)) {
			const [ accessor, value, errorMsg ] = proc;

			return (cell, runtime, wrappedResponse) => {
				if (get(wrappedResponse, accessor) == value && wrappedResponse.success)
					return null;

				return getErrorMsg(cell, wrappedResponse, errorMsg);
			};
		}

		return proc;
	}
};

const DEFAULT_PROCESSOR_OPTIONS = {
	get: {
		processors: {
			validate: (cell, runtime, wrappedResponse) => {
				return wrappedResponse.success ? null : getErrorMsg(cell, wrappedResponse);
			},
			success: (cell, runtime, wrappedResponse) => wrappedResponse,
			fail: (cell, runtime, wrappedResponse) => wrappedResponse,
			runtime: (cell, runtime) => runtime
		},
		transformers: {
			validate: PROCESSOR_TRANSFORMERS.validate
		}
	},
	post: {
		processors: {
			validate: (cell, runtime, wrappedResponse) => {
				return wrappedResponse.success ? null : getErrorMsg(cell, wrappedResponse);
			},
			success: (cell, runtime, wrappedResponse) => wrappedResponse,
			fail: (cell, runtime, wrappedResponse) => wrappedResponse,
			runtime: (cell, runtime) => runtime
		},
		transformers: {
			validate: PROCESSOR_TRANSFORMERS.validate
		}
	},
	custom: {
		processors: {
			validate: (cell, runtime, wrappedResponse) => {
				return wrappedResponse.payload ? null : getErrorMsg(cell, wrappedResponse);
			},
			success: (cell, runtime, response) => response,
			fail: (cell, runtime, error) => error,
			runtime: (cell, runtime) => runtime
		},
		transformers: {
			validate: PROCESSOR_TRANSFORMERS.validate
		}
	}
};

const DEFAULT_PARTITION_CLASSIFIER = {
	// XHR preset
	url: "xhrPreset",
	baseUrl: "xhrPreset",
	// Irrelevant data
	type: "garbage",
	persistent: "garbage"
};

export default class DataCell extends Hookable {
	constructor(config = {}, initConfig = {}) {
		super();

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
			xhrPreset: {}
		}, (val, k) => k[0] == "$" ? "processors" : classifier[k], "newConfig");

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
		this.xhrPreset = inject(xhrPreset, newConfig.xhrPreset);
		this.fetcher = mkFetcherObject(this, newConfig);
		this.stateTransforms = inject(
			newConfig.stateTransforms,
			initConfig.stateTransforms,
			"cloneTarget"
		);

		// The base runtime. External code may inject data
		// here. Other runtime objects may overwrite this
		this.baseRuntime = {
			cell: this
		};
		// The default runtime given at initialization
		this.defaultRuntime = newConfig.runtime;
		// Pending runtime. This value is meant to be
		// mutated during program execution
		this.pendingRuntime = null;

		// Save partitioned data for external reference
		this.processors = processors;
		this.config = newConfig;

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
			this
		);

		if (!initConfig.preventHooking)
			this.hookAll(newConfig.hooks);
		if (!initConfig.preventDataSet)
			this.setData(newConfig.data);
		if (!initConfig.preventStateSet)
			this.setState(newConfig.state);
		if (!initConfig.preventAutoFetch && newConfig.autoFetch)
			this.fetch();
	}

	setData(data) {
		this.data = data;
		this.callHooks("setData", data);
	}

	with(...runtimes) {
		this.pendingRuntime = this.pendingRuntime || clone(
			resolveVal(this.defaultRuntime, this, {})
		) || {};

		for (let i = 0, l = runtimes.length; i < l; i++) {
			const runtime = resolveVal(
				runtimes[i],
				this,
				this.pendingRuntime
			);

			inject(this.pendingRuntime, runtime, "override");
		}

		return this;
	}

	fetch(...args) {
		return this._fetch({}, ...args);
	}

	_fetch(runtime, ...args) {
		if (this.state.loading)
			return Promise.resolve(null);

		this.setState("loading");

		const fetcher = this.fetcher,
			doFetch = async _ => {
				if (this.defaultRuntime)
					runtime = inject(this.defaultRuntime, runtime, "cloneTarget");
				if (this.pendingRuntime)
					runtime = inject(this.pendingRuntime, runtime);
	
				runtime = inject(runtime, this.baseRuntime);
	
				runtime = this.process("runtime")(runtime);
				this.pendingRuntime = null;
	
				const response = await fetcher.fetch(runtime, ...args);
	
				if (response.success) {
					this.setState("loaded");
					this.setData(response.payload);
				} else {
					this.setState("error", {
						errorMsg: response.errorMsg
					});
				}
	
				this.setState({
					fetches: this.state.fetches + 1
				});
				
				fetcher.fetchResolvers = [];
				fetcher.enqueuedFetch = null;
				return response;
			};

		if (fetcher.defer) {
			const frLength = fetcher.fetchResolvers.length,
				deferResponse = new Promise(resolve => {
					fetcher.fetchResolvers.push(resolve);
				});

			if (frLength >= this.config.maxDefers)
				console.warn(`Maximum defers reached: ${this.config.maxDefers}`);
			else
				fetcher.enqueuedFetch = doFetch;

			if (!frLength) {
				requestFrame(async _ => {
					const fetchResolvers = fetcher.fetchResolvers;
					const response = await fetcher.enqueuedFetch();

					for (let i = 0, l = fetchResolvers.length; i < l; i++)
						fetchResolvers[i](response);
				});
			}

			return deferResponse;
		} else
			return doFetch();
	}

	setState(...states) {
		let newState = {};

		for (let i = 0, l = states.length; i < l; i++) {
			let state = states[i];

			if (typeof state == "string")
				state = STATE_PRESETS[state];

			Object.assign(newState, state);
		}

		newState = applyStateTransforms(this, newState);

		return mergeStateAndDispatchChanges(this, newState);
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
}

function applyStateTransforms(cell, newState) {
	const state = cell.state,
		transformMap = {},
		affected = {};
	
	newState = Object.assign({}, state, newState); 

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

		newState = isObject(transformedState) ? transformedState : newState;

		for (const k in newState) {
			if (!newState.hasOwnProperty(k) || k == key)
				continue;

			if (affected.hasOwnProperty(k)) {
				if (transformSession.transformed[k])
					console.error(`Attempted to transform '${k}' again, after already being transformed, starting at '${transformSession.source}', coming from '${key}'`);
				
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
		changes = {};
	let changed = false;

	for (const k in newState) {
		if (!newState.hasOwnProperty(k) || state[k] == newState[k])
			continue;

		if (!changed) {
			cell.callHooks("stateUpdate", newState, state);
			changed = true;
		}

		cell.callHooks(`stateUpdate:${k}`, newState[k], state[k]);
		changes[k] = {
			old: state[k],
			new: newState[k]
		};
		state[k] = newState[k];
	}

	return changes;
}

function mkFetcherObject(cell, config) {
	const fetcher = {
		method: casing(config.method || "custom").to.camel,
		fetch: null,
		defer: true,
		maxDefers: 1,
		enqueuedFetch: null,
		fetchResolvers: [],
		poll: mkPollingObject(config.poll)
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
			defer: "boolean",
			maxDefers: "number"
		},
		strictSchema: true
	});
	
	switch (fetcher.method) {
		case "get":
			fetcher.fetch = (runtime, url = null, preset = null) => {
				return fetchRequest(cell, runtime, "get", url, preset);
			};
			break;
		
		case "post":
			fetcher.fetch = (runtime, url = null, preset = null) => {
				return fetchRequest(cell, runtime, "post", url, preset);
			};
			break;

		case "custom":
			const fetchHandler = config.fetch || config.handler;

			if (typeof fetchHandler != "function")
				throw new TypeError(`Failed to make fetcher object: no fetcher defined`);

			fetcher.fetch = async (runtime, ...args) => {
				return fetchCustom(cell, runtime, fetchHandler, ...args);
			};
			break;

		default:
			throw new Error(`Failed to make fetcher object: '${fetcher.method}' is not a valid fetch method`);
	}

	return fetcher;
}

function mkPollingObject(pollConfig) {
	const poll = {
		interval: 1000,
		iterations: Infinity,
		running: true,
		// Internal fields
		iterationCount: 0,
		lastTimestamp: 0
	};

	if (typeof pollConfig == "number") {
		poll.interval = pollConfig;
		return poll;
	}

	if (!isObject(pollConfig))
		return null;

	inject(poll, pollConfig, {
		schema: {
			interval: "number",
			iterations: "number",
			running: "boolean"
		},
		strictSchema: true
	});

	return poll;
}

function fetchRequest(cell, runtime, method = "get", url = null, preset = null) {
	method = method.toLowerCase();
	
	if (typeof url != "string") {
		preset = url;
		url = null;
	}

	return new Promise(resolve => {
		const runtimePreset = this.process("preset")(runtime.preset);

		cell.xhrManager
			.use(cell.xhrPreset, runtimePreset, preset)
			[method](url)
			.success((response, xhr, xhrState) => {
				let successResponse = cell.mkSuccessResponse(response, {
					status: xhr.status,
					xhr,
					xhrState
				});

				const validation = validate(cell, runtime, successResponse);

				if (!validation) {
					successResponse = cell.process("success")(runtime, successResponse);

					cell.callHooks("success", successResponse);
					resolve(successResponse);
				} else {
					let failResponse = cell.mkErrorResponse(validation, {
						status: 0,
						xhr,
						xhrState
					});

					failResponse = cell.process("fail")(runtime, failResponse);

					cell.callHooks("fail", failResponse);
					resolve(failResponse);
				}
			})
			.fail((status, xhr, xhrState) => {
				let failResponse = cell.mkErrorResponse("Unknown Error", {
					status,
					xhr,
					xhrState
				});

				failResponse = cell.process("fail")(runtime, failResponse);
				const validation = validate(cell, runtime, failResponse);
				failResponse.errorMsg = validation;

				cell.callHooks("fail", failResponse);
				resolve(failResponse);
			});
	});
}

async function fetchCustom(cell, runtime, handler, ...args) {
	const response = await handler(cell, runtime, ...args);
	let wrappedResponse = response == null ?
		cell.mkErrorResponse(response) :
		cell.mkSuccessResponse(response);

	const validation = validate(cell, runtime, wrappedResponse);

	if (validation == null)
		return wrappedResponse;
	
	return cell.mkErrorResponse(validation);
}

function validate(cell, runtime, data) {
	const validation = cell.process("validate")(runtime, data);
	return typeof validation == "string" ? validation : null;
}

function getErrorMsg(cell, wrappedResponse, errorMsg) {
	errorMsg = typeof errorMsg == "function" ?
		errorMsg(cell, wrappedResponse) :
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
