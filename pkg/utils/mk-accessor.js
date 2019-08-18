import { cleanPath } from "./str";
import splitPath from "./split-path";

const abnormalRegex = splitPath.regexes.hasAbnormalPropertyChar;

export default function mkAccessor(path) {
	if (!Array.isArray(path))
		return path;

	let accessor = "";

	for (let i = 0, l = path.length; i < l; i++) {
		if (path == "")
			continue;

		const component = String(path[i]);

		if (!isNaN(path[i]))
			accessor += `[${cleanPath(component)}]`;
		else if (abnormalRegex.test(component))
			accessor += `[${cleanPath(component)}]`;
		else
			accessor += accessor ? `.${component}` : component;
	}

	return accessor;
}
