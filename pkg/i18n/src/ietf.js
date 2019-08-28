const ietfRegex = /^([a-z]{2,3})(?:[_-]([a-z]{3}))?(?:[_-]([a-z]{4}))?(?:[_-]([a-z]{2}|[0-9]{3}))?$/,
	subtags = ["primary", "extlang", "script", "region"];

function coerceIETF(ietf) {
	if (ietf instanceof IETF)
		return ietf;

	return new IETF(ietf);
}

export default class IETF {
	constructor(str) {
		this.reset();
		this.parse(str);
	}

	parse(str) {
		if (typeof str != "string")
			return this.reset();
	
		str = str.toLowerCase();
		const ex = ietfRegex.exec(str);
		if (!ex)
			return this.reset();
	
		subtags.forEach((s, i) => {
			this[s] = ex[i + 1] || null;
		});
		this.valid = true;
	
		let key = [];
		subtags.forEach(s => {
			if (this[s])
				key.push(this[s]);
		});
		this.key = key.join("_");
	
		this.value = str;
		return this;
	}
	
	reset() {
		subtags.forEach(s => {
			this[s] = null;
		});
	
		this.valid = false;
		this.key = "";
		this.value = "";
		return this;
	}

	toString() {
		return this.value;
	}

	equals(candidate) {
		return Boolean(candidate instanceof IETF && this.toString() == candidate.toString());
	}

	static findOptimalLocale(targetLocale, locales) {
		targetLocale = coerceIETF(targetLocale);
		let score = 0,
			optimalIdx = 0;

		for (let i = 0, l = locales.length; i < l; i++) {
			const locale = locales[i];
			let currentScore = 0;

			if (targetLocale.valid && locale.valid) {
				const sl = subtags.length;
				currentScore = sl;

				for (let j = 0; j < sl; j++) {
					if (targetLocale[subtags[j]] != locale[subtags[j]]) {
						currentScore = j;
						break;
					}
				}
			}

			if (currentScore > score)
				optimalIdx = i;
		}

		return coerceIETF(locales[optimalIdx]);
	}
}

export {
	coerceIETF
};
