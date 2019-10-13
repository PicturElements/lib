export default function parsePropStr(key) {
	const lastIdx = key.length - 1,
		ret = {
			key,
			srcKey: key,
			lazy: false,
			strict: false,
			typeModifier: false
		};

	switch (key[lastIdx]) {
		case "?":
			ret.lazy = true;
			ret.key = key.substr(0, lastIdx);
			break;
		
		case "!":
			ret.strict = true;
			ret.key = key.substr(0, lastIdx);
			break;
	}

	switch (key[0]) {
		case "@":
			ret.typeModifier = true;
			ret.key = ret.key.substr(1);
			break;
	}

	return ret;
}
