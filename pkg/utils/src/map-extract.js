import get from "./get";
import hasOwn from "./has-own";

export default function mapExtract(target, map, src) {
	for (const k in map) {
		if (!hasOwn(map, k))
			continue;

		let path = map[k],
			def;

		if (Array.isArray(path)) {
			def = path[1];
			path = path[0];
		} else
			def = map[k];

		target[k] = get(src, path, def);
	}

	return target;
}
