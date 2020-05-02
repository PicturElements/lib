import { hasOwn } from "@qtxr/utils";

const evtValidators = {
	natural: {
		check: /\d/,
		validate: /^\d+$/,
		allowNonPrintable: true
	},
	int: {
		check: /[\d-]/,
		validate: /^-?\d+$/,
		allowNonPrintable: true
	},
	float: {
		check: /[\d-.]/,
		validate(str) {
			return str.length && this.validateReg.test(str);
		},
		validateReg: /^-?\d*(?:\.\d*)?$/,
		allowNonPrintable: true
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
		check: /[a-z]/
	}
};

export default evtValidators;
