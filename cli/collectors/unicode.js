const path = require("path");
const {
	error,
	writeFileDeep
} = require("../../pkg/node-utils");
const { fetch } = require("../../utils");

const LVL1_REGEX_BINARY_PROPERTIES_LIST = [
	"ASCII",
	"Alphabetic",
	"Any",
	"Default_Ignorable_Code_Point",
	"Lowercase",
	"Noncharacter_Code_Point",
	"Uppercase",
	"White_Space"
];

const ALIASES = {
	categories: {
		LC: "L&"
	}
};

const COLLECTIONS = {
	categories: {
		L: ["Lu", "Ll", "Lt", "Lm", "Lo"],
		M: ["Mn", "Mc", "Me"],
		N: ["Nd", "Nl", "No"],
		P: ["Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po"],
		S: ["Sm", "Sc", "Sk", "So"],
		Z: ["Zs", "Zl", "Zp"],
		C: ["Cc", "Cf", "Cs", "Co", "Cn"]
	}
};

const ALIAS_URL = "https://www.unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt";

const hasOwn = (o, k) => Object.hasOwnProperty.call(o, k);

// Collector based on the following scripts:
// https://github.com/slevithan/xregexp/tree/master/tools
module.exports = async function unicode(options) {
	const d = await fetch(ALIAS_URL)();

	const pkgName = Object.keys(require("../../package.json").devDependencies)
		.find(key => /^@unicode\/unicode-/.test(key));

	if (!pkgName)
		return error("Failed to find Unicode package");

	console.log(`Using Unicode package ${pkgName}`);

	const pkg = require(pkgName),
		extended = options.keyOptions.includes("extended"),
		modular = options.keyOptions.includes("modular"),
		filename = options.args.length > 1 ?
			path.join(process.cwd(), options.args[1]) :
			path.join(__dirname, "./output/unicode.js");

	const out = {
		blocks: "",
		categories: "",
		properties: "",
		scripts: ""
	};

	const collect = (target, type, aliasKey, keys) => {
		keys = keys || pkg[type];

		const aliases = {};

		if (aliasKey) {
			const matches = d.matchAll(
				new RegExp(`^${aliasKey}((?:\\s*;\\s*[^\\s;]+)+)`, "gm")
			);
			
			for (const match of matches) {
				let keys = match[1]
					.split(/\s*;\s*/)
					.slice(1);

				for (const key of keys) {
					if (ALIASES[target] && hasOwn(ALIASES[target], key))
						keys.push(ALIASES[target][key]);
				}

				keys = [...new Set(keys)];

				for (const key of keys)
					aliases[key] = keys;
			}
		}

		for (const key of keys) {
			console.log(`[${type}] Encoding ${key}`);

			const ks = aliases[key] || [key];

			if (COLLECTIONS[target] && hasOwn(COLLECTIONS[target], ks[0])) {
				const subs = COLLECTIONS[target][ks[0]];
				out[target] += `${String.fromCharCode(31)}${ks.join(",")}<${subs.join(" ")}>`;
			} else {
				const encoded = encode(
					require(`${pkgName}/${type}/${key}/code-points`)
						.sort((a, b) => a > b ? 1 : -1)
				);
	
				if (out[target])
					out[target] += String.fromCharCode(31);
	
				out[target] += `${ks.join(",")}:${encoded}`;
			}
		}
	};

	collect("blocks", "Block", "blk");
	collect("categories", "General_Category", "gc");
	if (extended)
		collect("properties", "Binary_Property", null);
	else
		collect("properties", "Binary_Property", null, LVL1_REGEX_BINARY_PROPERTIES_LIST);
	collect("scripts", "Script", "sc");

	let payload,
		exportsPayload;

	if (modular) {
		payload = Object.keys(out)
			.map(key => `const ${key.toUpperCase()} = decode("${out[key]}");`)
			.join("\n")
			.replace(/\\/g, "\\\\");

		exportsPayload = `export {\n\t${
			Object.keys(out)
				.map(key => key.toUpperCase())
				.join(",\n\t")
		}\n};`;
	} else {
		payload = "const PROPERTIES = {\n\t";
		payload += Object.keys(out)
			.map(key => `\t${key}: decode("${out[key]}")`)
			.join(",\n")
			.replace(/\\/g, "\\\\");
		payload += "\n};";

		exportsPayload = "export default PROPERTIES;";
	}

	const modularTip = modular ?
			" --modular" :
			"",
		runTip = extended ?
			`Regenerate with 'ql collect unicode --extended${modularTip}'\n// Alternatively, omit --extended for basic support` :
			`Regenerate with 'ql collect unicode${modularTip}',\n// or run with --extended for extended support`,
		support = extended ?
			"For extended Unicode regex support (level 2)" :
			"For basic Unicode regex support (level 1)",
		unicodeUrl = extended ?
			"https://unicode.org/reports/tr18/#Extended_Unicode_Support" :
			"https://unicode.org/reports/tr18/#Basic_Unicode_Support";

	const code = `// Using ${pkgName}
// At ${new Date().toISOString()}
//
// ${runTip}
//
// * ${support}
// ${unicodeUrl}
//
// * Unicode data processed and provided by
// https://github.com/node-unicode/${pkgName.split("/").pop()}
//
// * Scraper inspired by
// https://github.com/slevithan/xregexp/tree/master/tools

${payload}

function decode(str) {
	const out = {},
		dependents = [];

	str.split(String.fromCharCode(31)).forEach(unit => {
		const ex = /([^:<]+)(?:<([^>]+)>)?(?::(.+))?/.exec(unit),
			data = {
				names: ex[1].split(","),
				deps: ex[2] ? ex[2].split(" ") : [],
				characters: [],
				ranges: [],
				size: 0
			};

		((ex[3] && ex[3].split(" ")) || []).forEach(part => {
			const comps = part.split("!");

			switch (comps.length) {
				case 1:
					data.characters.push(fromBase92(comps[0]));
					break;

				case 2: {
					const range = comps.map(fromBase92);
					data.size += (range[1] - range[0] + 1);
					data.ranges.push(range);
					break;
				}

				case 3: {
					const start = fromBase92(comps[0]),
						end = fromBase92(comps[2]),
						step = Number(comps[1]);

					for (let j = start; j <= end; j += step)
						data.characters.push(j);

					break;
				}
			}
		});

		data.names.forEach(key => out[key] = data);
		data.size += data.characters.length;

		if (ex[2])
			dependents.push(data);
	});

	dependents.forEach(dependent => {
		dependent.deps.forEach(dep => {
			const d = out[dep];

			if (d) {
				dependent.characters = dependent.characters.concat(d.characters);
				dependent.ranges = dependent.ranges.concat(d.ranges);
				dependent.size += d.size;
			}
		});
	});

	return out;
}

function fromBase92(str) {
	let out = 0,
		multiplicand = 1;

	for (let i = str.length - 1; i >= 0; i--) {
		out += (str.charCodeAt(i) - 35) * multiplicand;
		multiplicand *= 92;
	}

	return out;
}

${exportsPayload}
`;

	console.log(`Writing file at ${filename}`);

	writeFileDeep(
		filename,
		code
	);
};

function getRanges(codes, maxSieve = 10) {
	const used = [],
		resolved = [[]];

	const resolve = sieve => {
		let start = -1,
			last = -1;

		for (let i = 0, l = codes.length; i < l; i++) {
			const code = codes[i];

			if (last > -1 && (code - last != sieve || code in used)) {
				dispatch(start, last, sieve);
				start = code;
			}

			if (start == -1)
				start = code;
			last = code;
		}

		dispatch(start, last, sieve);
	};

	const dispatch = (start, end, sieve) => {
		if (end - start <= sieve)
			return false;

		for (let i = start; i <= end; i += sieve)
			used[i] = true;

		resolved[sieve].push([start, end]);

		return true;
	};

	for (let i = 1; i <= maxSieve; i++) {
		resolved[i] = [];
		resolve(i);
	}

	for (let i = 0, l = codes.length; i < l; i++) {
		if (!(codes[i] in used))
			resolved[0].push(codes[i]);
	}

	return resolved;
}

function encode(codes) {
	const ranges = getRanges(codes);
	let out = ranges[0]
		.map(toBase92)
		.join(" ");

	for (let i = 1, l = ranges.length; i < l; i++) {
		const subrange = ranges[i]
			.map(range => {
				const separator = i == 1 ?
					"!" :
					`!${i}!`;

				return toBase92(range[0]) + separator + toBase92(range[1]);
			})
			.join(" ");

		if (subrange) {
			if (out)
				out += " ";

			out += subrange;
		}
	}

	return out;
}

function toBase92(num) {
	let out = "";

	while (true) {
		const c = String.fromCharCode(35 + num % 92);

		out = c + out;
		num = Math.floor(num / 92);

		if (!num)
			break;
	}

	return out;
}
