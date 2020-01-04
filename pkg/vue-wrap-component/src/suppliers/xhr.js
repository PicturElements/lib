import { get } from "@qtxr/utils";

export default {
	init({ XHRManager, XHRState, decodeData }, defaultManager) {
		return (wrapper, used, path) => {
			const xhrPartitions = wrapper.internal.xhrPartitions || {},
				data = wrapper.getInjectorPartition("data");
		
			const gotten = get(data, path, null, {
					autoBuild: true,
					context: true
				}),
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
		
			xhrPartitions[path] = {
				manager,
				xhrState
			};
			wrapper.internal.xhrPartitions = xhrPartitions;
		
			if (used)
				return;
		
			wrapper.addMethod("xhr", function(path) {
				const vm = this,
					partition = xhrPartitions[path];
		
				if (!partition)
					throw new Error(`Cannot access XHR partition at '${path}' because it's not registered`);
		
				const loadingState = get(vm.$data, path);
		
				partition.manager.attachRuntime({
					vm,
					loadingState,
					setMsg(msg) {
						loadingState.msg = msg;
					},
					resolveErrorMsg() {
						const xhr = partition.manager.settings.state.xhr;
		
						if (xhr.responseText)
							this.setMsg(decodeData(xhr).message);
						else
							this.setMsg(`Network error (${xhr.status})`);
					}
				});
		
				return partition.manager;
			});
		
			wrapper.addMethod("setLoadingState", function(partition, state) {
				const dp = this.$data && this.$data[partition];
		
				if (!this.$data.hasOwnProperty(partition) || !dp || dp.constructor != Object)
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
