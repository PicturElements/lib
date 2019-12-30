import get from "./get";
import { isObj } from "./is";

export default function set(data, path, value, options) {
	const gotten = get(data, path, null, [
		"autoBuild|context",
		options
	]);

	if (isObj(gotten.context))
		gotten.context[gotten.key] = value;

	return value;
}
