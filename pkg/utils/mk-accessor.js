import { cleanPath } from "./str";

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
		else if (!/[[\]\s'"`]/.test(component))
			accessor += accessor ? `.${component}` : component;
		else
			accessor += `[${cleanPath(component)}]`;
	}

	return accessor;
}
