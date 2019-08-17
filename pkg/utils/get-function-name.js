const funcNameFindRegex = /function[\s\n]+([^(\s\n]+)/;

export default function getFunctionName(func) {
	if (typeof func != "function")
		return null;

	let name = func.name;

	if (typeof name == "string")
		return name;

	const stringified = String(func);

	if (stringified.indexOf("[object") == 0)
		return stringified.replace("[object ", "").slice(0, -1);
	else {
		const ex = funcNameFindRegex.exec(stringified);
		if (ex)
			return ex[1];
	}

	return "";
}
