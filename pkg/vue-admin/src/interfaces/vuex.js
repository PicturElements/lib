import {
	get,
	clone,
	inject,
	hasOwn,
	isObject,
	splitPath,
	mkAccessor,
	isConstructor
} from "@qtxr/utils";
import { Debouncer } from "@qtxr/uc";

import { usePlugin } from "../utils";

export default {
	interfaceName: "store",
	init(admin, store, partitionPath = "admin", key = "vue-admin-storage") {
		partitionPath = split(partitionPath);

		if (isObject(store) && isConstructor(store.Store)) {
			usePlugin(store);
			store = new store.Store();
		}

		if (!store)
			return null;

		return {
			setupStore(path, st) {
				path = [...partitionPath, ...split(path || "")];
				st = clone(st);
				ensureModules(store, path);

				st.namespaced = true;
				store.registerModule(path, st);
			},
			setupSessionStore(path, st) {
				path = [...partitionPath, ...split(path || "session")];
				st = clone(st);
				ensureModules(store, path);

				st.plugins = st.plugins || [];
				const sessionKey = key || "vue-admin-session-store",
					sessionData = admin.jsonManager.parse(
						sessionStorage.getItem(sessionKey)
					) || {},
					set = data => {
						sessionStorage.setItem(key,
							admin.jsonManager.stringify(data)
						);
					},
					debouncer = new Debouncer(500);

				// Inject session data and optionally inject new default data
				st.state = inject(sessionData, st.state);
				wrapMutations(st, state => debouncer.debounce(_ => set(state)));
				set(st.state);

				st.namespaced = true;
				store.registerModule(path, st);
			},
			setupLocalStore(path, st) {
				path = [...partitionPath, ...split(path || "local")];
				st = clone(st);
				ensureModules(store, path);

				st.plugins = st.plugins || [];
				const localData = admin.jsonManager.parse(
						localStorage.getItem(key)
					) || {},
					set = data => {
						localStorage.setItem(key,
							admin.jsonManager.stringify(data)
						);
					},
					debouncer = new Debouncer(500);

				// Inject session data and optionally inject new default data
				st.state = inject(localData, st.state);
				wrapMutations(st, state => debouncer.debounce(_ => set(state)));
				set(st.state);

				st.namespaced = true;
				store.registerModule(path, st);
			},
			queryState(accessor, def) {
				const partition = get(store.state, partitionPath);
				return get(partition, split(accessor), def);
			},
			commit(type, payload, options) {
				type = join([...partitionPath, ...split(type)]);
				return store.commit(type, payload, options);
			},
			dispatch(type, payload) {
				type = join([...partitionPath, ...split(type)]);
				return store.commit(type, payload);
			}
		};
	},
	connect(admin, wrapper) {
		wrapper.addMethod("queryState", accessor => {
			return admin.callInterfaceMethod("store", "queryState")(accessor);
		});
	
		wrapper.addMethod("commit", (type, payload, options) => {
			return admin.callInterfaceMethod("store", "commit")(type, payload, options);
		});
	
		wrapper.addMethod("dispatch", (type, payload) => {
			return admin.callInterfaceMethod("store", "dispatch")(type, payload);
		});
	},
	connectAdmin(admin) {
		admin.addMethod("queryState", accessor => {
			return admin.callInterfaceMethod("store", "queryState")(accessor);
		});
	
		admin.addMethod("commit", (type, payload, options) => {
			return admin.callInterfaceMethod("store", "commit")(type, payload, options);
		});
	
		admin.addMethod("dispatch", (type, payload) => {
			return admin.callInterfaceMethod("store", "dispatch")(type, payload);
		});
	}
};

function split(path) {
	return splitPath(toPropPath(path));
}

function toPropPath(path) {
	return path.replace(/\//g, ".");
}

function join(path) {
	return toUrlPath(mkAccessor(path));
}

function toUrlPath(path) {
	return path.replace(/\./g, "/");
}

// Generate Vuex modules when path is nested
function ensureModules(store, path) {
	let mod = store._modules.root;

	for (let i = 0, l = path.length - 1; i < l; i++) {
		const key = path[i];

		if (!hasOwn(mod._children, key)) {
			store.registerModule(path.slice(0, i + 1), {
				namespaced: true
			});
		}

		mod = mod._children[key];
	}
}

// In lieu of Vuex plugins in modules, wrap all mutations
// in a function that relays the mutation and then runs
// a callback when completed
function wrapMutations(store, callback) {
	if (!isObject(store.mutations))
		return;

	const mutations = store.mutations;
	for (const k in mutations) {
		if (!hasOwn(mutations, k))
			continue;

		const mutation = mutations[k];
		mutations[k] = function(state, ...args) {
			const retVal = mutation.call(this, state, ...args);
			callback(state, mutation, k, mutations);
			return retVal;
		};
	}
}
