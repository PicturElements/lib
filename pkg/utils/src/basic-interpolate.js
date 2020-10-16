import { resolveVal } from "./resolve-val";
import get from "./get";
import splitPath from "./split-path";

const SPLIT_REGEX = new RegExp(`\\$${splitPath.regexSources.match}`, "gi");

export default function basicInterpolate(str, data, def) {
	if (typeof str != "string")
		return "";

	const defUndefined = def === undefined;

	return str.replace(SPLIT_REGEX, (_, accessor) => {
		return get(
			data,
			accessor,
			defUndefined ?
				`$${accessor}` :
				resolveVal(def, accessor)
		);
	});
}
