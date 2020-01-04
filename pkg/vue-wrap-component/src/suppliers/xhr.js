import {
	get,
	isObject
} from "@qtxr/utils";

export default {
	init({ XHRManager, XHRState, decodeData }, defaultManager) {
		return (wrapper, used, path) => {
			const usedPaths = wrapper.internal.usedPaths || {},
				data = wrapper.getInjectorPartition("data"),
				gotten = get(data, path, null, "autoBuild|context"),
				state = {
					loaded: false,
					loading: false,
					error: false,
					msg: ""
				};
		
			for (const k in state) {
				if (state.hasOwnProperty(k) && !gotten.data.hasOwnProperty(k))
					gotten.data[k] = state[k];
			}
		
			usedPaths[path] = true;
			wrapper.internal.usedPaths = usedPaths;
		
			if (used)
				return;
		
			wrapper.addMethod("xhr", function(path) {
				const vm = this;
		
				if (!wrapper.internal.usedPaths.hasOwnProperty(path))
					throw new Error(`Cannot access XHR partition at '${path}' because it's not registered`);
		
				const loadingState = get(vm.$data, path);

				const xhrState = XHRState.promised()
					.hook("static:init", runtime => {
						setLoadingState(runtime.loadingState, "loading");
					})
					.hook("static:success", runtime => {
						setLoadingState(runtime.loadingState, "success");
					})
					.hook("static:fail", runtime => {
						setLoadingState(runtime.loadingState, "error");
					});
			
				const manager = new XHRManager({
					flush: ["once"],
					withRuntime: true,
					state: xhrState,
					inherits: defaultManager
				});
		
				manager.attachRuntime({
					vm,
					loadingState,
					setMsg(msg) {
						loadingState.msg = msg;
					},
					resolveErrorMsg() {
						const xhr = manager.settings.state.xhr;
		
						if (xhr.responseText)
							this.setMsg(decodeData(xhr).message);
						else
							this.setMsg(`Network error (${xhr.status})`);
					}
				});
		
				return manager;
			});
		
			wrapper.addMethod("setLoadingState", function(path, state) {
				if (!wrapper.internal.usedPaths.hasOwnProperty(path))
					return;

				const dp = get(this.$data, path);
		
				if (!isObject(dp))
					return;
		
				setLoadingState(dp, state);
			});
		};
	}
};

function setLoadingState(partition, data) {
	if (!partition)
		return;

	let state = {
		loaded: false,
		loading: false,
		error: false
	};

	if (data && data.constructor == Object)
		state = data;
	else switch (data) {
		case "loading":
			state.loading = true;
			break;
		case "success":
			state.loaded = true;
			break;
		case "error":
			state.error = true;
			break;
	}

	for (const k in partition) {
		if (partition.hasOwnProperty(k))
			partition[k] = state[k];
	}
}
