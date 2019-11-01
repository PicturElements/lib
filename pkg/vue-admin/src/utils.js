import Vue from "vue";

function hasPlugin(plugin) {
	return Boolean(Vue._installedPlugins) && Vue._installedPlugins.indexOf(plugin) > -1;
}

function usePlugin(plugin) {
	if (!hasPlugin(plugin))
		Vue.use(plugin);
}

export {
	hasPlugin,
	usePlugin
};
