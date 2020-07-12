import {
	DEBOUNCE_THRESHOLDS,
	DEFAULT_DEBOUNCE_THRESHOLD
} from "./common";
import { hasOwn } from "@qtxr/utils";
import listeners from "./listeners";

const listenerMap = {},
	listenerAliasMap = {};

listeners.forEach((l, i) => {
	listenerMap[l.name] = i;

	if (!hasOwn(DEBOUNCE_THRESHOLDS, l.debounceId))
		DEBOUNCE_THRESHOLDS[l.debounceId] = DEFAULT_DEBOUNCE_THRESHOLD;

	if (typeof l.alias == "string")
		listenerAliasMap[l.alias] = i;
	else if (Array.isArray(l.alias))
		l.alias.forEach(a => typeof a == "string" && (listenerAliasMap[a] = i));
});

export {
	listeners,
	listenerMap,
	listenerAliasMap
};
