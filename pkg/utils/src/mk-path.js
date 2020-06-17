import { cleanPath } from "./str-replace";

export default function mkPath(...components) {
	let accessor = "";

	for (let i = 0, l = components.length; i < l; i++) {
		let component = components[i];
		if (component == "")
			continue;

		if (Array.isArray(component))
			component = mkPath(...component);
		else
			component = String(component);

		if (!isNaN(component) && component != "Infinity" && component != "-Infinity")
			accessor += `[${cleanPath(component)}]`;
		else
			accessor += accessor && component[0] != "[" ? `.${component}` : component;
	}

	return accessor;
}
