import splitPath from "./split-path";
import get from "./get";
import { resolveVal } from "./resolve-val";

const splitRegex = new RegExp(`\\$${splitPath.regexSources.match}`, "g");

export default function basicInterpolate(str, data, def) {
	if (typeof str != "string")
		return "";

	const defUndefined = def === undefined;

	return str.replace(splitRegex, (_, accessor) => {
		return get(data, accessor, defUndefined ? `$${accessor}` : resolveVal(def, accessor));
	});
}
