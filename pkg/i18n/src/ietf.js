const ietfRegex = /^([a-z]{2,3})(?:[_-]([a-z]{3}))?(?:[_-]([a-z]{4}))?(?:[_-]([a-z]{2}|[0-9]{3}))?$/,
	subtagData = [
		{ tag: "primary" },
		{ tag: "extlang" },
		{
			tag: "script",
			convert: str => str[0].toUpperCase() + str.substr(1)
		},
		{
			tag: "region",
			convert: str => str.toUpperCase()
		}
	],
	// primary, region, script, extlang
	subtagPriority = [0, 3, 2, 1];

export default class IETF {
	constructor(str) {
		this.reset();
		this.parse(str);
	}

	parse(str) {
		if (typeof str != "string")
			return this.reset();
	
		str = str.toLowerCase();
		const ex = ietfRegex.exec(str),
			value = [];

		if (!ex)
			return this.reset();
		
		this.valid = true;

		for (let i = 0, l = subtagData.length; i < l; i++) {
			const data = subtagData[i],
				subtag = data.tag,
				capture = ex[i + 1];

			if (!capture) {
				this[subtag] = null;
				continue;
			}

			const subtagValue = typeof data.convert == "function" ?
				data.convert(capture) :
				capture;

			this[subtag] = subtagValue;
			value.push(subtagValue);
		}
	
		this.value = value.join("-");
		return this;
	}
	
	reset() {
		for (let i = 0, l = subtagData.length; i < l; i++)
			this[subtagData[i].tag] = null;
	
		this.valid = false;
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
		let score = 0,
			optimalIdx = 0;

		for (let i = 0, l = locales.length; i < l; i++) {
			const s = this.compare(locales[i], targetLocale);

			if (s > score)
				optimalIdx = i;
		}

		return this.coerce(locales[optimalIdx]);
	}

	static compare(locale, locale2) {
		locale = this.coerce(locale);
		locale2 = this.coerce(locale2);

		if (!locale.valid || !locale2.valid)
			return -1;

		let score = 0;

		for (let i = 0, l = subtagPriority.length; i < l; i++) {
			const subtag = subtagData[subtagPriority[i]].tag;

			score *= 3;

			if (locale[subtag] == locale2[subtag] && locale[subtag] !== null)
				score += 2;
			else if (!i)
				return 0;

			if (locale[subtag] != locale2[subtag])
				score--;
		}

		return score;
	}

	static coerce(candidate) {
		if (candidate instanceof IETF)
			return candidate;

		return new IETF(candidate);
	}
}
