import {
	round,
	hasOwn,
	mkConverter
} from "@qtxr/utils";
import Interpolator from "./interpolator";
import {
	prepareKeyframes,
	interpolate
} from "./interpolator-utils";

const convert = mkConverter({
	deg: {
		rad: Math.PI / 180,
		grad: 400 / 360,
		turn: 1 / 360
	},
	rad: "deg",
	grad: "deg",
	turn: "deg",
	px: {
		cm: 1 / (96 / 2.54),
		mm: 1 / (96 / 2.54 / 10),
		q: 1 / (96 / 2.54 / 40),
		in: 1 / 96,
		pc: 1 / (96 / 16),
		pt: 1 / (96 / 72)
	},
	cm: "px",
	mm: "px",
	q: "px",
	in: "px",
	pc: "px",
	pt: "px"
});

export default class FunctionListInterpolator extends Interpolator {
	constructor(keyframes) {
		super(keyframes);
		this.functionIndex = [];
		this.useTagging = false;
	}

	doInterpolation(kf, kf2, at, runtime) {
		at = this.getInterpolationPosition(kf, kf2, at);

		// Up to 100% more performant with precompiled keyframes
		if (kf.idx == kf2.idx)
			return createFunctionStrFromPrecompiled(kf.precompiledSelf, at, runtime);
		if (kf2.idx == kf.idx + 1)
			return createFunctionStrFromPrecompiled(kf.precompiled, at, runtime);

		let outStr = "";

		for (let i = 0, l = kf.functionList.length; i < l; i++) {
			const from = kf.functionList[i],
				name = from.name,
				to = kf2.functionDict[name];

			outStr += `${createFunctionStr(from, to, at, this.units[name], runtime)} `;
		}

		return outStr.trim();
	}

	static compile(keyframes, options, functions) {
		keyframes = prepareKeyframes(keyframes, options || {
			parseStringKeyframes: true
		});

		const interpolator = new FunctionListInterpolator(keyframes),
			functionIndexer = {
				lookup: {},
				index: []
			};

		for (let i = 0, l = keyframes.length; i < l; i++) {
			const { functionList, functionDict } = parseFunctionList(keyframes[i].raw, interpolator.units, functions, functionIndexer);
			keyframes[i].functionList = functionList;
			keyframes[i].functionDict = functionDict;
		}

		interpolator.functionIndex = functionIndexer.index;

		fillInPlaceholders(keyframes, functionIndexer.index);
		fillPlaceholders(keyframes[0].functionList, interpolator, functions);
		fillPlaceholders(keyframes[keyframes.length - 1].functionList, interpolator, functions);
		interpolatePlaceholders(keyframes);
		precompileFunctionStr(interpolator, keyframes);

		return interpolator;
	}
}

function parseFunctionList(raw, units, functions, functionIndexer) {
	const splitFunctionRegex = /([^()\s]+)(?:\(((?:\([^)]+?\)|[^()])+?)\))?/g,
		functionList = [],
		functionDict= {};

	while (true) {
		const ex = splitFunctionRegex.exec(raw);
		if (!ex)
			break;

		const fName = ex[1];

		if (!hasOwn(functions, fName))
			throw new SyntaxError(`'${fName}' is not a known function`);

		if (!ex[2])
			throw new SyntaxError(`Failed to parse function (found '${ex[0]}' but no arguments)`);

		const functionSignature = functions[fName];
		let item = null;

		if (ex[2] === undefined) {
			item = mkPlaceholder(fName);
		} else {
			item = {
				name: fName,
				placeholder: false,
				args: parseArgs(fName, ex[2], units, functions)
			};
		}

		if (hasOwn(functionDict, fName))
			replaceFunction(item, functionList, functionDict);
		else
			pushFunction(item, functionList, functionDict);

		item.paramDelimiter = functionSignature.outParamDelimiter || functionSignature.paramDelimiter || ", ";

		if (!hasOwn(functionIndexer.lookup, fName)) {
			functionIndexer.lookup[fName] = true;
			functionIndexer.index.push(fName);
		}
	}

	return {
		functionList,
		functionDict
	};
}

function pushFunction(item, list, dict) {
	list.push(item);
	dict[item.name] = item;
	item.idx = list.length;
}

function replaceFunction(item, list, dict) {
	// Never overwrite a non-placeholder function with a placeholder one
	if (!item.placeholder) {
		const oldItem = dict[item.name];
		item.idx = oldItem.idx;
		dict[item.name] = item;
		list[oldItem.idx] = item;
	}
}

function mkPlaceholder(name) {
	return {
		name,
		placeholder: true,
		args: []
	};
}

const argSeparatorRegexes = {
	space: /(?:[^\s(](?:\(.*?\))?)+/g,
	comma: /(?:[^,(](?:\(.*?\))?)+/g
};

function splitArgs(str, type) {
	const args = [],
		reg = argSeparatorRegexes[type];

	if (!reg)
		throw new Error(`Failed to split arguments: '${type}' is not a known separator type`);

	while (true) {
		const ex = reg.exec(str);
		if (!ex || !ex[0])
			break;

		args.push(ex[0].trim());
	}

	return args;
}

const valUnitRegex = /([\d.e-]*[\d])\s*([\w%]*)/;

function parseArgs(fName, raw, units, functions) {
	const fs = functions[fName],
		vuRegex = fs.argRegex || valUnitRegex,
		argsOut = [];
	let args = (typeof fs.splitArgs == "function" ? fs.splitArgs : splitArgs)(raw, fs.paramDelimiter || "comma");

	verifyArgs(args, raw, fName, fs);

	if (typeof fs.conformArgs == "function")
		args = fs.conformArgs(args);

	if (!units[fName])
		units[fName] = [];

	for (let i = 0, l = args.length; i < l; i++) {
		let argObj = null;
		const arg = args[i],
			ex = vuRegex.exec(arg);

		if (!ex)
			throw new SyntaxError(`Cannot parse '${raw}' because '${arg}' is not a valid argument (in ${fName})`);

		if (typeof fs.parseArg == "function")
			argObj = fs.parseArg(arg, i, ex);
		else {
			if (isNaN(ex[1]))
				throw new SyntaxError(`Cannot construct interpolator: argument is a NaN value ('${arg}' in ${fName})`);

			argObj = mkArgument(
				Number(ex[1]),
				ex[2]
			);
		}

		const argUnit = units[fName] && units[fName][i],
			parsedUnit = argObj.unit;

		if (hasOwn(units, fName) && argUnit && parsedUnit && argUnit != parsedUnit) {
			const converted = convert(argObj.value, parsedUnit, argUnit);

			if (converted === null)
				throw new SyntaxError(`Cannot construct interpolator: '${argUnit}' and '${parsedUnit}' are incompatible units (in arg list '${raw}', arg '${arg}' in ${fName})`);

			argObj.value = converted;
		} else
			units[fName][i] = argObj.unit || units[fName][i] || "";

		argsOut.push(argObj);
	}

	return argsOut;
}

function mkArgument(value, unit) {
	return{
		value,
		unit
	};
}

function verifyArgs(args, raw, fName, functionSignature) {
	const paramSignature = functionSignature.params,
		aLen = args.length;

	if (typeof paramSignature == "function") {
		if (functionSignature.params(args, raw, fName, functionSignature))
			return;
	} else {
		if (typeof paramSignature == "number" && paramSignature == aLen)
			return;

		if (Array.isArray(paramSignature)) {
			for (let i = 0, l = paramSignature.length; i < l; i++) {
				if (paramSignature[i] == aLen)
					return;
			}
		}
	}

	throw new SyntaxError(`Cannot parse '${raw}' in '${fName}' because it doesn't have a correct parameter signature`);
}

// TODO: make this an interface method on Interpolator (as doExtrapolation)
function fillInPlaceholders(keyframes, index) {
	for (let i = 0, l = keyframes.length; i < l; i++) {
		for (let j = 0, l2 = index.length; j < l2; j++) {
			const fName = index[j],
				kf = keyframes[i];

			if (!hasOwn(kf.functionDict, fName))
				pushFunction(mkPlaceholder(fName), kf.functionList, kf.functionDict);
		}
	}
}

function fillPlaceholders(list, interpolator, functions) {
	for (let i = 0, l = list.length; i < l; i++) {
		if (!list[i].placeholder)
			continue;

		const func = list[i],
			fName = func.name,
			argUnit = interpolator.units[fName],
			da = functions[fName].defaultArgs,
			defaultArgs = Array.isArray(da) ? da : [da];

		for (let j = 0, l2 = defaultArgs.length; j < l2; j++) {
			func.args.push(
				mkArgument(
					defaultArgs[j % defaultArgs.length],
					Array.isArray(argUnit) ? (argUnit[j % defaultArgs.length] || "") : argUnit
				)
			);
		}

		func.placeholder = false;
	}
}

function interpolatePlaceholders(keyframes) {
	// const
}

const argSeparators = {
	space: " ",
	comma: ", "
};

function createFunctionStr(kf, kf2, at, runtime, unitsArr) {
	let separator = argSeparators[kf.paramDelimiter],
		out = "";

	if (typeof separator != "string")
		separator = argSeparators.comma;

	for (let i = 0, l = kf.args.length; i < l; i++) {
		let val = interpolate(kf.args[i].value, kf2.args[i].value, at, runtime);

		if (typeof val == "number")
			val = round(val, 5);

		out += ((out ? separator : "") + val + (unitsArr[i] || ""));
	}

	return `${kf.name}(${out})`;
}

// Precompiled structure:
// alternating strings and interpolation data
function precompileFunctionStr(interpolator, keyframes) {
	for (let a = 0, l = keyframes.length; a < l; a++) {
		const kf = keyframes[a],
			kf2 = keyframes[a + 1];

		if (a < l - 1)
			kf.precompiled = precompile(interpolator, kf, kf2);
		kf.precompiledSelf = precompile(interpolator, kf, kf);
	}
}

function precompile(interpolator, kf, kf2) {
	const compiled = [],
		functionList = kf.functionList;

	let separator = argSeparators[kf.paramDelimiter];

	if (typeof separator != "string")
		separator = argSeparators.comma;

	for (let i = 0, l = functionList.length; i < l; i++) {
		const func = functionList[i],
			func2 = kf2.functionDict[func.name],
			args = func.args,
			args2 = func2.args,
			units = interpolator.units[func.name];

		if (i > 0)
			pushToCompiled(compiled, ` ${func.name}(`);
		else
			pushToCompiled(compiled, `${func.name}(`);

		for (let j = 0, l2 = args.length; j < l2; j++) {
			if (j > 0)
				pushToCompiled(compiled, separator);

			pushToCompiled(compiled, [
				args[j],
				args2[j]
			]);
			pushToCompiled(compiled, units[j]);
		}

		pushToCompiled(compiled, ")");
	}

	return compiled;
}

function pushToCompiled(compiled, item) {
	const lastIdx = compiled.length - 1;

	if (typeof item == "string") {
		if (typeof compiled[lastIdx] == "string")
			compiled[lastIdx] += item;
		else
			compiled.push(item);
	} else {
		if (typeof compiled[lastIdx] != "string")
			throw new Error("Failed to precompile: strings and non-strings must be evenly interspersed");

		compiled.push(item);
	}
}

function createFunctionStrFromPrecompiled(precompiled, at, runtime) {
	let str = "";

	for (let i = 0, l = precompiled.length; i < l; i++) {
		if (i % 2 == 0)
			str += precompiled[i];
		else {
			let val = interpolate(
				precompiled[i][0].value,
				precompiled[i][1].value,
				at,
				runtime
			);

			if (typeof val == "number")
				val = round(val, 5);

			str += val;
		}
	}

	return str;
}
