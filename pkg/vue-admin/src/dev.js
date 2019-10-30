import {
	get,
	isEnv
} from "@qtxr/utils";

const isDev = isEnv("dev");

function noop() {}

const devLog = isDev ? (admin, ...messages) => {
	if (get(admin, "config.dev.suppressLogs") !== true)
		console.log(...messages);
} : noop;

const devWarn = isDev ? (admin, ...messages) => {
	if (get(admin, "config.dev.suppressWarnings") !== true)
		console.warn(...messages);
} : noop;

export {
	devLog,
	devWarn
};
