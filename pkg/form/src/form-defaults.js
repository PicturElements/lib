import { basicInterpolate } from "@qtxr/utils";

// When adding defaults, remember this:
// https://stackoverflow.com/questions/21177489/selectionstart-selectionend-on-input-type-number-no-longer-allowed-in-chrome
// If not absolutely necessary, use text, search, password, tel, or url types or else checkWord
// will not work properly

const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i,
	dateRegex = /^(\d{1,2})\s*\/\s*(\d{2})$/,
	nameRegex = /[^\d,./\\"=@#$%^&*(){}[\]!?|~<>;]/;

const defaults = {
	firstName: {
		value: "",
		checkKey: nameRegex,
		validate: mkRangeValidator(1, 20, "Please specify a first name", "Name too long. Maximum: $max characters"),
	},
	lastName: {
		value: "",
		checkKey: nameRegex,
		validate: mkRangeValidator(1, 20, "Please specify a last name", "Name too long. Maximum: $max characters"),
	},
	email: {
		type: "email",
		value: "",
		checkKey: /[^\s]/,
		validate: mkRegexValidator(emailRegex, "Invalid email address")
	},
	business: {
		value: "",
		validate: mkRangeValidator(1, 48, "Please specify a business name", "Business name too long. Maximum: $max characters")
	},
	address: {
		value: "",
		validate: mkRangeValidator(1, Infinity, "Please specify an address")
	},
	city: {
		value: "",
		validate: mkRangeValidator(1, Infinity, "Please specify a city")
	},
	state: {
		value: "",
		checkKey: "word",
		checkWord(str) {
			return str.length <= 2;
		},
		validate: mkRangeValidator(2, 2, "Please specify a state in XX form", "Please specify a state in XX form"),
	},
	password: {
		type: "password",
		value: "",
		validate(val, inp, inps) {
			if (val.length < 8)
				return "Password too short. Minimum: 8 characters";
		},
		propagate: "password2"
	},
	password2: {
		type: "password",
		value: "",
		validate(val, inp, inps) {
			if (!inp.initialized)
				return;

			if (val.length < 8)
				return "Password too short. Minimum: 8 characters";
			if (inps.password.value != val)
				return "These passwords don't match";
		}
	},
	card: {
		type: "tel",
		value: "",
		checkKey: /[\d\s]/,
		checkWord(str) {
			return str.replace(/\s/g, "").length <= 19;
		},
		validate(val) {
			val = val.replace(/\s/g, "");

			if (!/^\d{13,19}$/.test(val))
				return "Card numbers are between 13 and 19 digits in length";
			else if (!luhn(val))
				return "This is not a valid card number";
		},
		extract(val) {
			return val.replace(/\s/g, "");
		}
	},
	date: {
		type: "tel",
		value: "",
		checkKey: /[\d/\s]/,
		validate(val) {
			const ex = dateRegex.exec(val);

			if (!ex)
				return "Dates follow this syntax: MM/YY";

			const month = Number(ex[1]),
				year = Number(ex[2]),
				monthNo = year * 12 + month,
				date = new Date(),
				currMonthNo = (date.getFullYear() - 2e3) * 12 + date.getMonth() + 1,
				lastExpiryMonthNo = currMonthNo + 20 * 12;

			if (month > 12)
				return `Incorrect month ${month}`;

			if (monthNo < currMonthNo)
				return "This card is expired";

			if (monthNo > lastExpiryMonthNo)
				return "Expiry date too far ahead";
		},
		extract(val, inp, payload) {
			const ex = dateRegex.exec(val);
			payload.month = Number(ex[1]);
			payload.year = Number(ex[2]);
		}
	},
	cvv: {
		type: "tel",
		value: "",
		checkKey: "natural",
		checkWord(str) {
			return str.length <= 4;
		},
		validate(val) {
			if (!/^\d{3,4}$/.test(val))
				return "CVV numbers are between 3 and 4 digits in length";
		}
	},
	phone: {
		value: "",
		checkKey: /[0-9+\s-]/,
		validate: mkRegexValidator(/^[0-9+\s-]+$/, "Please specify a valid phone number")
	},
	zip: {
		value: "",
		checkKey: "natural",
		validate: mkRangeValidator(1, Infinity, "This field cannot be empty")
	},
	country: {
		value: "",
		checkKey: "name",
		validate: mkRangeValidator(1, Infinity, "This field cannot be empty")
	},
	checkbox: {
		type: "checkbox",
		value: false
	},
	dropdown: {
		type: "dropdown",
		value: null,
		validate(val) {
			if (val === null)
				return "Please select a value";
		}
	},
	radio: {
		type: "radio",
		value: null,
		validate(val) {
			if (val === null)
				return "Please select a value";
		}
	},
	count: {
		type: "count",
		value: 0,
		min: 0,
		max: 100,
		checkWord: "int"
	},
	media: {
		type: "media",
		value: null,
		targetSize: {
			w: 600,
			h: 600
		},
		validate(val, inp) {
			if (!inp.enforceSize)
				return;

			if (!Array.isArray(val))
				val = val ? [] : [val];
		},
		extract(val, inp, payload) {
			if (inp.multiple) {
				if (Array.isArray(val))
					return val;

				return val ? [] : [val];
			}

			return val;
		}
	},
	textarea: {
		type: "textarea",
		maxLength: 10000,
		validate(val, inp, payload) {
			if (val.length > inp.maxLength)
				return `Maximum length surpassed: ${val.length}/${inp.maxLength}`;
		}
	}
};

function luhn(str) {
	let sum = 0,
		ptr = 0;

	for (let i = str.length - 1; i >= 0; i--) {
		let num = Number(str[i]);

		if ((ptr++ % 2) == 0)
			sum += num;
		else {
			num *= 2;

			if (num > 9)
				num -= 9;

			sum += num;
		}
	}

	return sum % 10 == 0;
}

function mkRegexValidator(regex, errorMsg, invert) {
	invert = !invert;

	return val => {
		if (regex.test(val) ^ invert)
			return errorMsg;
	};
}

function mkRangeValidator(min, max, shortMsg = "Text too short. Minimum: $min", longMsg = "Text too long. Maximum: $max") {
	min = min || 1;
	max = max || Infinity;

	return val => {
		let msg = null;

		if (val.length < min)
			msg = shortMsg;
		if (val.length > max)
			msg = longMsg;

		if (typeof msg == "string") {
			return basicInterpolate(msg, {
				min,
				max,
				len: val.length
			});
		}
	};
}

export default defaults;

export {
	luhn,
	mkRegexValidator,
	mkRangeValidator
};
