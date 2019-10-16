import evtValidators from "./validators";

function isValidKey(evt, type) {
	if (!evt.key || !type || (!evtValidators.hasOwnProperty(type) && type.constructor != Object))
		return true;

	return checkKey(evt, evt.key.toLowerCase(), evtValidators[type] || type);
}

// https://stackoverflow.com/questions/21177489/selectionstart-selectionend-on-input-type-number-no-longer-allowed-in-chrome
// https://html.spec.whatwg.org/multipage/input.html#do-not-apply
// Please note that if the target text, search, password, tel, or url types or else checkWord
// will not work properly

const validTypes = {
	text: true,
	search: true,
	password: true,
	tel: true,
	url: true
};

function isValidWord(evt, type) {
	const target = evt.target,
		val = target.value || "";

	if (!evt.key || evt.key.length != 1 || !type || (!evtValidators.hasOwnProperty(type) && type.constructor != Object))
		return true;

	if (!("selectionStart" in target)) {
		console.warn("Cannot validate word: event target must be an input with a selectionStart property");
		return true;
	}

	if (target.type && !validTypes.hasOwnProperty(target.type))
		console.warn(`Cannot get selection bounds for input with type '${target.type}' and so cannot accurately determine the value string. Please consider changing the input type to either text, search, password, tel, or url.`);

	const testStr = val.substr(0, target.selectionStart) + evt.key + val.substr(target.selectionEnd);
	return validateStr(testStr, evtValidators[type] || type);
}

function checkKey(evt, key, validatorPartition) {
	const checker = validatorPartition.check;

	if (typeof checker == "function")
		return validatorPartition.check(key);

	if ((key.length > 1 && validatorPartition.allowNonPrintable !== false) || (validatorPartition.allowBindings !== false && (evt.ctrlKey || evt.metaKey || evt.altKey)))
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

export {
	isValidKey,
	isValidWord,
	getCoords
};