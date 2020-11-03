import {
	hasOwn,
	requestFrame
} from "@qtxr/utils";
import URL from "@qtxr/url";

import {
	IMPL,
	RequestManager,
	RequestState,
	RequestResponse,
	encodePayload,
	normalizeContentType
} from "./request";

class FetchManager extends RequestManager {
	constructor(options) {
		super(options, {
			presetSchema: PRESET_SCHEMA,
			options: DEFAULT_FETCH_OPTIONS,
			stateConstructor: FetchState,
			responseConstructor: FetchResponse
		});
	}

	initRequest() {
		const abortController = new AbortController();

		return {
			abortController,
			res: null
		};
	}

	sendRequest(runtime) {
		const p = runtime.preset;
		let timedout = false;

		fetch(runtime.url, {
			method: runtime.method,
			headers: p.headers,
			body: encodePayload(p.payload, p),
			mode: p.mode,
			credentials: p.credentials,
			cache: p.cache,
			redirect: p.redirect,
			referrer: p.referrer,
			referrerPolicy: p.referrerPolicy,
			integrity: p.integrity,
			keepalive: p.keepalive,
			signal: runtime.abortController.signal
		})
			.then(async response => {
				runtime.res = response;

				const reader = response
						.clone()
						.body
						.getReader(),
					total = getResponseContentLength(response);
				let loaded = 0;

				while (true) {
					runtime.state.applyProgress("download", loaded, total);

					const {
						done,
						value
					} = await reader.read();

					if (done)
						break;

					loaded += value.length;
				}

				runtime.state.applyResponse(runtime.response, runtime.response);
				runtime.state.applyFinish(runtime.response);
			})
			.catch(e => {
				runtime.res = {
					bodyUsed: false,
					headers: new Headers(),
					ok: false,
					redirected: false,
					status: 0,
					statusText: "",
					type: "basic",
					url: "",
					invalid: true
				};

				if (e instanceof TypeError)
					runtime.state.applyFail(runtime.response, runtime.response);
				else if (timedout)
					runtime.state.applyTimeout(runtime.response, runtime.response);
				else
					runtime.state.applyAbort(runtime.response, runtime.response);
				
				runtime.state.applyFinish(runtime.response);
			});

		if (hasOwn(runtime.preset, "timeout") && runtime.preset.timeout) {
			setTimeout(_ => {
				timedout = true;

				if (!runtime.finished)
					runtime.abortController.abort();
			}, runtime.preset.timeout);
		}
	}
}

class FetchState extends RequestState {
	constructor(runtime) {
		super(runtime);
	}

	applyInit() {
		requestFrame(_ => {
			this.callHooks("init", true, this.response, this);
		});
	}

	abort() {
		this.runtime.abortController.abort();
		return this;
	}
}

class FetchResponse extends RequestResponse {
	constructor(manager, runtime) {
		super(manager, runtime);
	}

	clone() {
		return new FetchResponse(this.manager, this.runtime);
	}

	async decode(to = null) {
		if (typeof to == "boolean")
			to = null;

		const response = this.runtime.res;
		let hint = to;

		if (hasOwn(this.preset, "decodeTo"))
			hint = this.preset.decodeTo;
		else if (hasOwn(this.preset, "responseType"))
			hint = this.preset.responseType;

		switch (hint) {
			case "arraybuffer":
				return await this.arrayBuffer();

			case "blob":
				return await this.blob();

			case "json":
				return await this.json();

			case "text":
				return await this.text();
		}

		let contentType = response.headers.get("content-type") || response.headers.get("contenttype");
		contentType = normalizeContentType(contentType);

		switch (contentType) {
			case "json":
				return await this.json();

			case "formdata":
				return await this.formData();
		}

		return await this.text();
	}

	async arrayBuffer() {
		if (this.runtime.res.invalid)
			return await new Blob().arrayBuffer();

		return await this.runtime.res
			.clone()
			.arrayBuffer();
	}

	async blob() {
		if (this.runtime.res.invalid)
			return new Blob();

		return await this.runtime.res
			.clone()
			.blob();
	}

	async formData() {
		if (this.runtime.res.invalid)
			return new FormData();

		return await this.runtime.res
			.clone()
			.formData();
	}

	async json() {
		if (this.runtime.res.invalid)
			return {};

		return await this.runtime.res
			.clone()
			.json();
	}

	async text() {
		if (this.runtime.res.invalid)
			return "";

		return await this.runtime.res
			.clone()
			.text();
	}

	get body() {
		return this.runtime.res.body;
	}

	get bodyUsed() {
		return this.runtime.res.bodyUsed;
	}

	get headers() {
		return this.runtime.res.headers;
	}

	get status() {
		return this.runtime.res.status;
	}

	get statusText() {
		return this.runtime.res.statusText;
	}

	get type() {
		return this.runtime.res.type;
	}

	get url() {
		return this.runtime.res.url;
	}
}

function getResponseContentLength(response) {
	return Number(response.headers.get("content-length") || response.headers.get("contentlength")) || 0;
}

const PRESET_SCHEMA = {
	// General fields
	baseUrl: ["string", URL],
	urlParams: Object,
	hooks: Object,
	timeout: "number",
	responseType: "string",
	decodeTo: "string",
	lazyDecode: "boolean",
	rejectOnError: "boolean",
	enforceReponseReturn: "boolean",
	// fetch-centered options fields
	headers: [Object, IMPL.Headers],
	payload: v => typeof v != "function",
	body: v => typeof v != "function",
	mode: "string",
	credentials: ["string", IMPL.FederatedCredential, IMPL.PasswordCredential],
	cache: "string",
	redirect: "string",
	referrer: "string",
	referrerPolicy: "string",
	integrity: "string",
	keepalive: "boolean"
};

const DEFAULT_FETCH_OPTIONS = {
	noDuplicatePresets: false,
	stateConstructor: FetchState,
	stateArgs: [],
	flush: []
};

FetchState.NULL = new FetchState();

// Fetch is the default FetchManager that
// handles miscellaneous requests. If wanted, new instances
// of FetchManager may be created to deal with specific cases
// and to avoid concurrency issues
const Fetch = new FetchManager();

FetchManager.default = Fetch;

export {
	Fetch,
	FetchManager,
	FetchState,
	FetchResponse
};
