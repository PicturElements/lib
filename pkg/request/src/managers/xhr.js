import {
	hasOwn,
	requestFrame
} from "@qtxr/utils";
import URL from "@qtxr/url";

import {
	IMPLS,
	REQUEST_MANAGER_SPECIES_SYM,
	RequestManager,
	RequestState,
	RequestResponse,
	mergeData,
	encodePayload,
	normalizeContentType
} from "./request";

const HEADER_REGEX = /(\S+):\s*(.+)/g;

class XHRManager extends RequestManager {
	constructor(options) {
		super(options, {
			options: DEFAULT_XHR_OPTIONS,
			presetSchema: PRESET_SCHEMA,
			stateConstructor: XHRState,
			responseConstructor: XHRResponse
		});
	}

	initRequest(runtime) {
		const xhr = new XMLHttpRequest();

		xhr.onreadystatechange = ({ target: x }) => {
			const state = runtime.state;
			state.callHooks("statechange", true, x);

			if (x.readyState == 2) {
				runtime.state.applyProgress(
					"download",
					0,
					getResponseContentLength(x)
				);
			} else if (x.readyState == 4) {
				state.applyResponse(runtime.response, x);
				state.applyFinish(runtime.response);
			}
		};

		xhr.onerror = ({ target: x }) => {
			runtime.state.applyFail(runtime.response, x);
		};

		xhr.ontimeout = ({ target: x }) => {
			runtime.state.applyTimeout(runtime.response, x);
		};

		xhr.onabort = ({ target: x }) => {
			runtime.state.applyAbort(runtime.response, x);
		};

		xhr.onprogress = evt => {
			runtime.state.applyProgress("download", evt.loaded, evt.total);
		};

		xhr.upload.onprogress = evt => {
			runtime.state.applyProgress("upload", evt.loaded, evt.total);
		};

		if (hasOwn(runtime.preset, "responseType"))
			xhr.responseType = runtime.preset.responseType || "text";
		else if (IMPLS.BLOB != IMPLS.NULL)
			xhr.responseType = "blob";
		else
			xhr.responseType = "text";

		if (hasOwn(runtime.preset, "timeout"))
			xhr.timeout = runtime.preset.timeout;

		xhr.open(runtime.method, runtime.url);

		return { xhr };
	}

	sendOneWayRequest(runtime) {
		setHeaders(runtime.xhr, runtime.preset);
		runtime.xhr.send();
	}

	sendTwoWayRequest(runtime) {
		const preset = runtime.preset,
			payloadPrecursor = mergeData(preset.payload, runtime.payload),
			payload = encodePayload(payloadPrecursor, preset);

		setHeaders(runtime.xhr, preset);
		runtime.state.applyPayload(payload);
		runtime.xhr.send(payload);
	}
}

class XHRState extends RequestState {
	constructor(manager, runtime) {
		super(manager, runtime);
		this.xhr = null;
	}

	link(manager, runtime) {
		super.link(manager, runtime);
		this.xhr = runtime.xhr;
	}

	applyInit() {
		requestFrame(_ => {
			this.callHooks("init", true, this.xhr, this);
			const runtime = this.runtime;

			if (runtime.usesUpload)
				runtime.state.applyProgress("upload", 0, runtime.upload.total);
			else if (runtime.download.total)
				runtime.state.applyProgress("download", 0, runtime.download.total);
		});
	}

	abort() {
		this.xhr.abort();
		return this;
	}
}

class XHRResponse extends RequestResponse {
	constructor(manager, runtime) {
		super(manager, runtime);
		this.xhr = runtime.xhr;
	}

	async decode(to = null, clone = true) {
		if (typeof to == "boolean") {
			clone = to;
			to = null;
		}

		const xhr = this.xhr;
		let hint = to;

		if (hasOwn(this.preset, "decodeTo"))
			hint = this.preset.decodeTo;
		else if (hasOwn(this.preset, "responseType"))
			hint = this.preset.responseType;

		switch (hint) {
			case "arraybuffer":
				return await this.arrayBuffer(clone);

			case "blob":
				return await this.blob(clone);

			case "document":
				if (!xhr.response)
					return null;

				return clone ?
					xhr.response.cloneNode(true) :
					xhr.response;

			case "json":
				return await this.json(clone);

			case "text":
				return await this.text();
		}

		let contentType = xhr.getResponseHeader("content-type") || xhr.getResponseHeader("contenttype");
		contentType = normalizeContentType(contentType);

		switch (contentType) {
			case "json":
				return await this.json(clone);

			case "formdata":
				return await this.formData();
		}

		return await this.text();
	}

	async arrayBuffer(clone = true) {
		const xhr = this.xhr;

		if (isInvalidResponse(xhr))
			return await new Blob().arrayBuffer();

		switch (xhr.responseType) {
			case "arraybuffer":
				return clone ?
					xhr.response.slice() :
					xhr.response;

			case "blob":
				return await xhr.response.arrayBuffer();

			case "document": {
				const serializer = new XMLSerializer();
				return await toBuffer(serializer.serializeToString(xhr.response));
			}

			case "json":
				return await toBuffer(JSON.stringify(xhr.response));

			case "text":
				return await toBuffer(xhr.responseText);
		}

		return warnNotSupported(xhr, "arraybuffer");
	}

	async blob(clone = true) {
		const xhr = this.xhr;

		if (isInvalidResponse(xhr))
			return new Blob();

		switch (xhr.responseType) {
			case "arraybuffer":
				return new Blob([xhr.response]);

			case "blob":
				return clone ?
					xhr.response.slice() :
					xhr.response;

			case "document": {
				const serializer = new XMLSerializer(),
					type = xhr.response instanceof IMPLS.XML_DOCUMENT ?
						"text/xml" :
						"text/html";

				return new Blob([
					serializer.serializeToString(xhr.response)
				], {
					type
				});
			}

			case "json":
				return new Blob([
					JSON.stringify(xhr.response)
				], {
					type: "application/json"
				});

			case "text":
				return new Blob([xhr.responseText], {
					type: "text/plain"
				});
		}

		return warnNotSupported(xhr, "blob");
	}

	async formData() {
		const xhr = this.xhr;

		if (isInvalidResponse(xhr))
			return new FormData();

		return warnNotSupported(this.xhr, "formdata");
	}

	async json(clone = true) {
		const xhr = this.xhr;

		if (isInvalidResponse(xhr))
			return {};

		switch (xhr.responseType) {
			case "arraybuffer":
				return parseJson(parseBuffer(xhr.response));

			case "blob": {
				const str = await xhr.response.text();
				return parseJson(str);
			}

			case "json":
				return clone ?
					parseJson(JSON.stringify(xhr.response)) :
					xhr.response;

			case "text":
				return parseJson(xhr.responseText);
		}

		return warnNotSupported(xhr, "json");
	}

	async text() {
		const xhr = this.xhr;

		if (isInvalidResponse(xhr))
			return "";

		switch (xhr.responseType) {
			case "arraybuffer":
				return parseBuffer(xhr.response);

			case "blob":
				return await xhr.response.text();

			case "document": {
				const serializer = new XMLSerializer();
				return serializer.serializeToString(xhr.response);
			}

			case "json":
				return JSON.stringify(xhr.response);

			case "text":
				return xhr.responseText;
		}

		return warnNotSupported(xhr, "text");
	}

	get body() {
		return this.decode(false);
	}

	get bodyUsed() {
		return this.runtime.usesUpload;
	}

	get headers() {
		const headerStr = this.xhr.getAllResponseHeaders(),
			headers = {};

		while (true) {
			const ex = HEADER_REGEX.exec(headerStr);
			if (!ex)
				break;

			headers[ex[1]] = ex[2].trim();
		}

		return headers;
	}

	get status() {
		return this.xhr.status;
	}

	get statusText() {
		return this.xhr.statusText;
	}

	get type() {
		return "basic";
	}

	get url() {
		return this.xhr.responseURL;
	}
}

function setHeaders(xhr, preset) {
	const headers = preset.headers;

	for (const k in headers) {
		if (hasOwn(headers, k))
			xhr.setRequestHeader(k, headers[k]);
	}
}

function getResponseContentLength(xhr) {
	return Number(xhr.getResponseHeader("content-length") || xhr.getResponseHeader("contentlength")) || 0;
}

function toBuffer(str) {
	return new Blob([str]).arrayBuffer();
}

// Adapted from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
function parseBuffer(buffer) {
	String.fromCharCode.apply(null, new Uint8Array(buffer));
}

function parseJson(str) {
	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}

function warnNotSupported(xhr, target) {
	console.warn(`This response cannot decode data to ${target} as the response type of the underlying XMLHttpRequest is ${xhr.responseType}`);
	return null;
}

function isInvalidResponse(xhr) {
	return xhr.responseType != "text" && xhr.response === null;
}

const PRESET_SCHEMA = {
	baseUrl: ["string", URL],
	headers: [Object, IMPLS.HEADERS],
	urlParams: Object,
	payload: v => typeof v != "function",
	body: v => typeof v != "function",
	hooks: Object,
	timeout: "number",
	responseType: "string",
	decodeTo: "string",
	lazyDecode: "boolean",
	rejectOnError: "boolean",
	enforceResponseReturn: "boolean"
};

const DEFAULT_XHR_OPTIONS = {
	noDuplicatePresets: false,
	stateConstructor: XHRState,
	stateArgs: [],
	flush: []
};

XHRState.NULL = new XHRState();

// XHR is the default XHRManager that
// handles miscellaneous requests. If wanted, new instances
// of XHRManager may be created to deal with specific cases
// and to avoid concurrency issues
const XHR = new XHRManager();

XHRManager.default = XHR;
XHRManager[REQUEST_MANAGER_SPECIES_SYM] = "xhr";

export {
	XHR,
	XHRManager,
	XHRState,
	XHRResponse
};
