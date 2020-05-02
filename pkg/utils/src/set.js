import get from "./get";
import { isObj } from "./is";

const GET_OPTS = {
	autoBuild: true,
	context: true
};

export default function set(target, path, value, options) {
	options = options ?
		[GET_OPTS, options] :
		GET_OPTS;

	const gotten = get(target, path, null, options);

	if (isObj(gotten.context))
		gotten.context[gotten.key] = value;

	return value;
}
