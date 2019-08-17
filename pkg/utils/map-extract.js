import get from "./get";

export default function mapExtract(target, map, src) {
	for (const k in map) {
		if (!map.hasOwnProperty(k))
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
