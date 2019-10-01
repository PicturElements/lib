const superfluousPrefixRegex = /^ql(?:ib)?\s+/;

module.exports = function parseCLIInput(argv, aliases, extraArgs) {
	extraArgs = extraArgs || [];

	if (typeof argv == "string") {
		argv = argv.trim();

		const ex = superfluousPrefixRegex.exec(argv);
		if (ex)
			argv = argv.substr(ex[0].length);
		
		argv = process.argv.slice(0, 2).concat(toArgv(argv));
	}

	// Deprecated
	if (argv.constructor == Object) {
		console.log("Object argv is deprecated");
		argv.args = [...argv.args, ...extraArgs];
		argv.rawArgs = [...argv.rawArgs, ...extraArgs];
		return argv;
	}

	const [execPath, binPath, ...args] = argv,
		rawArgs = [...args, ...extraArgs],
		options = {
			execPath,
			binPath,
			rawArgs,
			args: [],
			keyOptions: [],
			kvOptions: {}
		};

	// Apply aliases
	for (let i = rawArgs.length - 1; i >= 0; i--) {
		const keyword = rawArgs[i];

		if (aliases.hasOwnProperty(keyword))
			applyAlias(rawArgs, i, aliases[keyword]);
	}

	for (const arg of rawArgs) {
		if (arg.indexOf("--") == 0) {
			const kv = arg.substr(2).split(/\s*=\s*/);

			if (kv.length == 1)
				options.keyOptions.push(kv[0]);
			else
				options.kvOptions[kv[0]] = kv[1];
		} else
			options.args.push(arg);
	}

	return options;
};

function toArgv(argStr) {
	const splitRegex = /[^\s"']+|(?:(["'])((?:[^\\]|\\.)*?)\1)/g,
		disallowedUnescapedCharsRegex = /[^\\]["']/,
		unescapeRegex = /\\(.)/g,
		argv = [];

	if (typeof argStr != "string")
		throw new TypeError("Failed to generate argv: input is not a string");

	while (true) {
		const ex = splitRegex.exec(argStr);
		if (!ex)
			break;

		if (ex[1]) {
			const arg = ex[2].replace(unescapeRegex, "$1");
			argv.push(arg);
		} else {
			const arg = ex[0];

			if (disallowedUnescapedCharsRegex.test(arg))
				throw new SyntaxError(`Failed to generate argv: '${arg}' includes unescaped characters`);

			argv.push(arg);
		}
	}

	return argv;
}

function applyAlias(args, idx, targetCommand) {
	const newArgs = toArgv(targetCommand);
	args.splice(idx, 1, ...newArgs);

	/*const newArgs = toArgv(targetCommand),
		shift = newArgs.length - 1,
		startIdx = Math.max(args.length, idx) + shift - 1,
		endIdx = idx + shift;

	for (let i = startIdx; i > endIdx; i--)
		args[i + 1] = args[i - shift];

	for (let i = endIdx; i >= idx; i--)
		args[i] = newArgs[i - idx];

	return args;*/
}
