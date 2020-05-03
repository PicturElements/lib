import { hasOwn } from "@qtxr/utils";

const evtValidators = {
	natural: {
		check: /\d/,
		validate: /^\d+$/,
		allowNonPrintable: true,
		allowBindings: true
	},
	int: {
		check: /[\d-]/,
		validate: /^-?\d+$/,
		allowNonPrintable: true,
		allowBindings: true
	},
	float: {
		check: /[\d-.]/,
		validate(str) {
			return str.length && this.validateReg.test(str);
		},
		validateReg: /^-?\d*(?:\.\d*)?$/,
		allowNonPrintable: true,
		allowBindings: true
	},
	singleLine: {
		check(key) {
			return !hasOwn(this.disallowed, key);
		},
		disallowed: {
			enter: true
		}
	},
	word: {
		check: /[a-z]/,
		allowNonPrintable: true,
		allowBindings: true
	}
};

export default evtValidators;
