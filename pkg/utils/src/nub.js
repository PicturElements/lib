import QNDSet from "./qnd-set";
import forEach from "./for-each";

export default function nub(arr) {
	const set = new QNDSet(arr),
		out = [];

	forEach(set, v => out.push(v));
	return out;
}
