import { sym } from "@qtxr/utils";

export default {
	init(manager) {
		return (wrapper, used) => {
			if (used)
				return;
		
			wrapper.assert.hasAsset("i18nManager", "i18n");
			
			const ns = sym("wc-i18n-ns");
			
			wrapper.addMethod("loadLocaleFragment", manager.loadFragment.bind(manager));
			wrapper.addMethod("hookLocale", (...args) => manager.hookNS(ns, ...args));
			wrapper.addHook("beforeDestroy", _ => manager.clearHooksNS(ns));
		};
	}
};
