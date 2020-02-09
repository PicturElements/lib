class Lookup {
	constructor() {
		this.lookup = Object.create(null);
		this.length = 0;
	}

	has(key) {
		if (typeof key != "string" && typeof key != "symbol")
			return false;

		return Boolean(this.lookup[key]);
	}

	add(key) {
		if (!this.has(key)) {
			this.lookup[key] = true;
			this.length++;
		}
		
		return this;
	}

	delete(key) {
		if (this.has(key)) {
			this.lookup[key] = false;
			this.length--;
			return true;
		}

		return false;
	}
}

export default function lookup(arr = [], splitChar = "|") {
	const out = new Lookup();

	if (typeof arr == "string")
		arr = arr.split(splitChar);

	for (let i = arr.length - 1; i >= 0; i--)
		out.add(arr[i]);

	return out;
}
