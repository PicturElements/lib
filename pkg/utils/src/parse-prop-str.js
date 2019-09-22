export default function parsePropStr(key) {
	const lastIdx = key.length - 1,
		ret = {
			key,
			srcKey: key,
			lazy: false,
			strict: false
		};

	switch (key[lastIdx]) {
		case "?":
			ret.key = key.substr(0, lastIdx);
			ret.lazy = true;
			break;
		
		case "!":
			ret.key = key.substr(0, lastIdx);
			ret.strict = true;
			break;
	}

	return ret;
}
