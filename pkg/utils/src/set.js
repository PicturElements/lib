import { isObj } from "./is";
import get from "./get";

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
