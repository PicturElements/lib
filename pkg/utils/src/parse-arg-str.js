import parseStr from "./parse-str";
import splitArgStr from "./split-arg-str";

export default function parseArgStr(str, argSeparator) {
	return splitArgStr(str, argSeparator).map(parseStr);
}
