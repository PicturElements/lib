let keySeed = 0;

export default function sym(prefix) {
	keySeed += (Math.floor(Math.random() * 1e6) + 1e6);
	const postfix = keySeed.toString(36),
		key = prefix ? `${prefix}:${postfix}` : postfix;
	
	return typeof Symbol == "undefined" ? `@Polyfill:Symbol - ${key}` : Symbol(key);
}
