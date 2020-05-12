import {
	hasOwn,
	isObject,
	spliceStr,
	applyPattern
} from "@qtxr/utils";
import EVT from "./evt";
import evtValidators from "./validators";

// https://stackoverflow.com/questions/21177489/selectionstart-selectionend-on-input-type-number-no-longer-allowed-in-chrome
// https://html.spec.whatwg.org/multipage/input.html#do-not-apply
// Please note that if the target type isn't text, search, password, tel, or url,
// checkWord will not work properly

const VALID_TYPES = {
	text: true,
	search: true,
	password: true,
	tel: true,
	url: true
};

function isValidKey(evt, type) {
	const partition = typeof type == "string" ?
		evtValidators[type] :
		type;

	if (!isObject(type) || !evt.key)
		return true;

	return checkKey(evt, evt.key.toLowerCase(), partition);
}

function isValidWord(evt, type) {
	const target = evt.target,
		val = target.value || "",
		key = evt.key,
		partition = typeof type == "string" ?
			evtValidators[type] :
			type;

	if (!isObject(partition) || !key || key.length != 1)
		return true;

	if (partition.allowBindings !== false && hasModifier(evt))
		return true;

	if (!("selectionStart" in target)) {
		console.warn("Cannot validate word: event target must be an input with a selectionStart property");
		return true;
	}

	if (target.type && !hasOwn(VALID_TYPES, target.type))
		console.warn(`Cannot get selection bounds for input with type '${target.type}' and so cannot accurately determine the value string. Please consider changing the input type to either text, search, password, tel, or url`);

	const testStr = spliceStr(
		val,
		target.selectionStart,
		target.selectionEnd,
		evt.key
	);
	return validateStr(testStr, partition);
}

function checkKey(evt, key, validatorPartition) {
	const checker = validatorPartition.check;

	if (typeof checker == "function")
		return validatorPartition.check(key);

	const validNonPrintable = key.length > 1 && validatorPartition.allowNonPrintable !== false,
		validBinding = validatorPartition.allowBindings !== false && hasModifier(evt);

	if (validNonPrintable || validBinding)
		return true;

	if (checker instanceof RegExp)
		return checker.test(key);

	return true;
}

function validateStr(str, validatorPartition) {
	const validate = validatorPartition.validate;

	if (typeof validate == "function")
		return validatorPartition.validate(str);

	if (validate instanceof RegExp)
		return validate.test(str);

	return true;
}

function getCoords(evt, element = null) {
	const p = evt.touches ? evt.touches[0] : evt;

	if (element instanceof Element) {
		const bcr = element.getBoundingClientRect();

		return {
			x: p.clientX - bcr.left,
			y: p.clientY - bcr.top
		};
	}

	return {
		x: p.clientX,
		y: p.clientY
	};
}

function hasModifier(evt) {
	return Boolean(evt && (evt.ctrlKey || evt.altKey || evt.shiftKey || evt.metaKey));
}

function runPattern(evt, args) {
	const result = {
		output: null,
		success: false,
		prevent: false
	};

	if (!("selectionStart" in evt.target)) {
		console.warn("Cannot run pattern: event target must be an input with a selectionStart property");
		return result;
	}

	if (evt.target.type && !hasOwn(VALID_TYPES, evt.target.type)) {
		console.warn(`Cannot get selection bounds for input with type '${evt.target.type}' and so cannot accurately determine the value string. Please consider changing the input type to either text, search, password, tel, or url`);
		return result;
	}

	let res;

	switch (evt.type) {
		case "paste":
			res = runPatternPaste(evt, args);
			break;

		case "keydown":
			res = runPatternKeydown(evt, args);
			break;
	}

	if (!res) {
		result.success = true;
		return result;
	}

	Object.assign(result, res);
	result.success = true;
	result.prevent = true;
	return result;
}

function runPatternPaste(evt, args) {
	const insertion = (evt.clipboardData || window.clipboardData).getData("text"),
		target = evt.target;

	if (!insertion)
		return null;

	return applyPattern(Object.assign({
		source: target.value,
		start: target.selectionStart,
		end: target.selectionEnd,
		insertion
	}, args));
}

function runPatternKeydown(evt, args) {
	const target = evt.target;
	let ss = target.selectionStart,
		se = target.selectionEnd,
		key = evt.key,
		insertion = key,
		deletion = 0;

	switch (EVT.getKey(evt)) {
		case "backspace":
			insertion = "";
			if (ss == se)
				deletion = 1;
			break;

		default:
			if (key.length > 1 || hasModifier(evt))
				return null;
	}

	return applyPattern(Object.assign({
		source: target.value,
		start: ss,
		end: se,
		insertion,
		deletion
	}, args));
}

export {
	isValidKey,
	isValidWord,
	getCoords,
	hasModifier,
	runPattern
};
