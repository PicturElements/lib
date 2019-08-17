import getConstructorName from "./get-constructor-name";

// generate a function parameter string reminiscent of a
// TypeScript parameter signature
function genFuncParamsStr(funcName, signature, expanded) {
	const params = signature.map(genParamStr);

	if (expanded)
		return `${funcName}(\n  ${params.join(",\n  ")}\n)`;

	return `${funcName}(${params.join(", ")})`;
}

function genParamStr(paramObj) {
	let paramStr = paramObj.name;

	if (!paramObj.required)
		paramStr += "?";

	paramStr += `: ${genTypeStr(paramObj.type)}`;

	return paramStr;
}

function genTypeStr(type) {
	if (typeof type == "string")
		return type;
	
	if (typeof type == "function")
		return getConstructorName(type);

	if (type && type.constructor == Array)
		return type.map(genTypeStr).join(" | ");
	
	return "any";
}

export {
	genFuncParamsStr,
	genParamStr,
	genTypeStr
};
