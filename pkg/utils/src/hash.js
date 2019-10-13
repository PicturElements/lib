// Basic hashing function optimized for structure
// preservation and decent performance
export default function hash(value, reduce = false) {
	try {
		if (reduce)
			return hashString(runHash(value), reduce);

		return runHash(value);
	} catch(e) {
		throw new Error("Cyclic structure found");
	}
}

function hashSafe(value, reduce = false) {
	try {
		if (reduce)
			return hashString(runHash(value), reduce);

		return runHash(value);
	} catch(e) {
		return null;
	}
}

function runHash(value) {
	switch (typeof value) {
		case "undefined":
			return "undefined";
		case "number":
			return `num:${value}`;
		case "bigint":
			return `big:${value}`;
		case "boolean":
			return `bool:${value}`;
		case "boolean":
			return `bool:${value}`;
		case "string":
			return `str:${hashString(value)}`;
		case "function":
			return `fun:${hashString(value.toString())}`;
		case "object":
			return hashObject(value);
	}
}

function hashObject(value) {
	if (value === null)
		return "null";

	switch (value.constructor) {
		case Array: {
			let out = `arr:[`;

			if (value.length > 0)
				out += runHash(value[0]);

			for (let i = 1, l = value.length; i < l; i++)
				out += `,${runHash(value[i])}`;

			return out + "]";
		}

		case Object:
		default: {
			let out = value.constructor == Object ? "obj:{" : `${value.constructor.name || "inst"}:{`;

			const keys = Object.keys(value).sort();

			if (keys.length > 0)
				out += runHash(value[keys[0]]);

			for (let i = 1, l = keys.length; i < l; i++)
				out += `,${runHash(value[keys[i]])}`;

			return out + "}";
		}
	}
}

// Very basic rolling hash implementation
const p = 1721,
	m = 137438953447;

// The maximum size of a UTF-16 code unit is 16 bits, 65535,
// which means that the maximum value the modulo variable may
// have is given by the following:
// hash + codePoint * power < 2**53 - 1
// Assume hash, codePoint, and power have the maximum size...
// m + codePoint * m < 2**53 - 1
// (codePoint + 1) * m < 2**53 - 1
// 2**16 * m < 2**53 - 1
// m = 137438953471
// Then find the closest prime smaller than m, and this is
// the biggest safe number that will never yield a number larger
// than 2**53 - 1 in the hashing process
// 137438953447 is the largest prime less than 137438953471
// Note that this assumes that p is never larger than 2**16 - 1

function hashString(str, reduce = false) {
	let hash = 0,
		power = 1;

	for (let i = 0, l = str.length; i < l; i++) {
		hash = (hash + str.charCodeAt(i) * power) % m;
		power = (power * p) % m;
	}

	if (reduce)
		return `${hash.toString(36)}/${str.length}`;

	return `${hash}/${str.length}`;
}

/*
Testing code for collisions - in testing,
hashString has an even distribution

function test(iter = 1e6, strLen = 20, saveAllCollisions = false) {
	const testedRand = {},
		hashed = {};
	let uniques = 0,
		collisions = 0;

	for (let i = 0; i < iter; i++) {
		const randStr = randUTF16Str(strLen);

		if (testedRand[randStr])
			continue;
		testedRand[randStr] = true;

		uniques++;

		const hash = hashString(randStr);

		if (saveAllCollisions) {
			if (!hashed.hasOwnProperty(hash))
				hashed[hash] = [];

			hashed[hash].push(randStr);

			if (hashed[hash].length > 1) {
				console.log(hashed[hash], i / iter);
				collisions++;
			}
		} else {
			if (hashed.hasOwnProperty(hash)) {
				console.log(hashed[hash], randStr, i / iter);
				collisions++;
			}

			hashed[hash] = randStr;
		}
	}

	console.log(
`Uniques: ${uniques}
Collisions: ${collisions}
Expected collisions: ${(uniques**2 / m) / 2}`);
}

function randUTF16Str(length) {
	let out = "";

	while (length--)
		out += String.fromCharCode(Math.random() * 2**16);

	return out;
}*/

export {
	hashSafe,
	hashObject,
	hashString
};
