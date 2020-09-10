import splitPath from "./split-path";
import get from "./get";
import { resolveVal } from "./resolve-val";

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
