import { unescape } from "./str";

const stringLiteralRegex = /^(?:(["'`])((?:[^\\]|\\.)*?)\1)$/;

export default function parseStrStr(str) {
	if (typeof str != "string")
		return null;

	const ex = stringLiteralRegex.exec(str);
	if (!ex)
		return null;

	return unescape(ex[2]);
}
