import { unescape } from "./str";

const STR_LITERAL_REGEX = /^(?:(["'`])((?:[^\\]|\\.)*?)\1)$/;

export default function parseStrStr(str) {
	if (typeof str != "string")
		return null;

	const ex = STR_LITERAL_REGEX.exec(str);
	if (!ex)
		return null;

	return unescape(ex[2]);
}
