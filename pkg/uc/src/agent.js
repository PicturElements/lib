import {
	hasOwn,
	isObject
} from "@qtxr/utils";
import Version from "./version";

const browserHints = [
		["SamsungBrowser", "Samsung Browser"],
		["UCBrowser", "UC Browser"],
		"Edge",
		["YaBrowser", "Yandex"],
		["Presto", "Opera"],
		["OPR", "Opera"],
		"Epiphany",
		"Chrome",
		["MSIE", "IE"],
		["Trident", "IE"],
		"Safari",
		"Firefox",
		"Thunderbird",
		"Instagram",
		"Messenger"
	],
	sysHints = [
		"Windows Phone",
		"Android",
		["Windows NT", "Windows"],
		["iPhone", "iOS"],
		["iPad", "iPadOS"],
		["Mac OS X", "Macintosh"],
		["X11; U;", "Ubuntu"],
		["X11; Ubuntu", "Ubuntu"],
		"Linux"
	],
	sysFamilies = [
		["Windows Phone", "Windows"],
		"Android",
		["Windows NT", "Windows"],
		["iPhone", "iOS"],
		["iPad", "iOS"],
		["Mac OS X", "Macintosh"],
		["X11; U;", "Linux"],
		["X11; Ubuntu", "Linux"],
		"Linux"
	],
	deviceHints = [
		"Windows Phone",
		"iPhone",
		"iPad"
	],
	brandHints = [
		["Windows Phone", "Microsoft"],
		["iPhone", "Apple"],
		["iPad", "Apple"],
		["SM-", "Samsung"]
	],
	msVersions = {
		"5.0": "2000",
		"5.1": "XP",
		"5.2": "XP",
		"6.0": "Vista",
		"6.1": "7",
		"6.2": "8",
		"6.3": "8.1",
		"10": "10"
	},
	macVersions = {
		"10_0": "Cheetah",
		"10_1": "Puma",
		"10_2": "Jaguar",
		"10_3": "Panther",
		"10_4": "Tiger",
		"10_5": "Leopard",
		"10_6": "Snow Leopard",
		"10_7": "Lion",
		"10_8": "Mountain Lion",
		"10_9": "Mavericks",
		"10_10": "Yosemite",
		"10_11": "El Capitan",
		"10_12": "Sierra",
		"10_13": "High Sierra",
		"10_14": "Mojave",
		"10_15": "Catalina"
	},
	androidVersions = [
		["Petit Four", new Version("1.1")],
		["Cupcake", new Version("1.5")],
		["Donut", new Version("1.6")],
		["Eclair", new Version("2.1")],
		["Froyo", new Version("2.2.3")],
		["Gingerbread", new Version("2.3.7")],
		["Honeycomb", new Version("3.2.6")],
		["Ice Cream Sandwich", new Version("4.0.4")],
		["Jelly Bean", new Version("4.3.1")],
		["KitKat", new Version("4.4.4")],
		["Lollipop", new Version("5.1.1")],
		["Marshmallow", new Version("6.0.1")],
		["Nougat", new Version("7.1.2")],
		["Oreo", new Version("8.1")],
		["Pie", new Version("9")],
		["Android 10", new Version("10")],
		["Future Android Version", new Version("1000")]
	];

export default class Agent {
	constructor(agent) {
		this.parse(agent);
	}

	parse(agent) {
		const browser = {
			name: null,
			version: null,
			engine: null
		};

		const system = {
			name: null,
			version: null,
			device: null,
			brand: null
		};

		agent = agent || navigator.userAgent;

		// Browser parsing
		browser.name = searchHints(browserHints) || "Unknown";

		let browserVersion = null;

		switch (browser.name) {
			case "Opera":
				browserVersion = extractPrefixed("(?:OPR|Version)/");
				break;
			case "Safari":
				browserVersion = extractPrefixed("Version/");
				break;
			case "Yandex":
				browserVersion = extractPrefixed("YaBrowser/");
				break;
			case "UC Browser":
				browserVersion = extractPrefixed("UCBrowser/");
				break;
			case "Samsung Browser":
				browserVersion = extractPrefixed("SamsungBrowser/");
				break;
			case "IE":
				browserVersion = extractPrefixed("rv:") || extractPrefixed("(?:MSIE |Trident/)");
				break;
			default:
				browserVersion = extractPrefixed(browser.name + "/");
		}

		browser.version = new Version(browserVersion);

		// System parsing
		system.name = searchHints(sysHints);

		let sysVersion = null,
			nickname = null,
			prefix = null;

		switch (system.name) {
			case "Windows Phone":
				sysVersion = extractPrefixed("Windows Phone ");
				break;

			case "Android": {
				sysVersion = extractPrefixed("Android ");
				const nick = getVersionNickname(sysVersion, androidVersions);
				if (nick)
					nickname = nick;
				break;
			}

			case "Windows":
				sysVersion = extractPrefixed("Windows NT ");
				if (sysVersion)
					prefix = "NT " + sysVersion;
				if (hasOwn(msVersions, sysVersion))
					nickname = msVersions[sysVersion];
				break;

			case "iOS":
				sysVersion = dashToDot(extractVersion(/OS ([\d_]+)/));
				break;

			case "Macintosh": {
				const nick = extractVersion(/\d+_\d+/);
				if (hasOwn(macVersions, nick))
					nickname = macVersions[nick];
				sysVersion = dashToDot(extractVersion(/OS X ([\d_]+)/));
				break;
			}

			case "Ubuntu":
				sysVersion = extractPrefixed("Ubuntu/");
				break;
		}

		system.version = new Version(sysVersion, nickname, prefix);

		system.device = searchHints(deviceHints);
		system.brand = searchHints(brandHints);
		system.family = searchHints(sysFamilies);

		// Utils
		function extractPrefixed(prefix) {
			return extractVersion(new RegExp(prefix + "([\\d.]+)"));
		}

		function extractVersion(regex) {
			const ex = regex.exec(agent);
			return ex ? (ex[1] || ex[0]) : "";
		}

		function searchHints(hints) {
			for (let i = 0, l = hints.length; i < l; i++) {
				if (hints[i] instanceof Array) {
					if (agent.indexOf(hints[i][0]) > -1)
						return hints[i][1];
				} else if (agent.indexOf(hints[i]) > -1)
					return hints[i];
			}

			return null;
		}

		this.browser = browser;
		this.system = system;
	}

	matches(matchObj) {
		let matches = true,
			browsers = matchObj.browser,
			systems = matchObj.os;

		if (!isObject(matchObj)) {
			const newMatchObj = {},
				matchArr = Array.isArray(matchObj) ? matchObj : [matchObj];

			for (let i = 0, l = matchArr.length; i < l; i++) {
				if (typeof matchArr[i] == "string")
					newMatchObj[matchArr[i]] = true;
			}

			matchObj = newMatchObj;
		}

		if (!browsers && !systems) {
			browsers = matchObj;
			systems = null;
		}

		if (browsers) {
			const version = this.browser && browsers[this.browser.name.toLowerCase()];
			matches &= (version === true || (version && this.browser.version.compare(version) >= 0));
		}

		if (systems) {
			const version = this.system && systems[this.system.name.toLowerCase()];
			matches &= (version === true || (version && this.system.version.compare(version) >= 0));
		}

		return !!matches;
	}
}

function dashToDot(str) {
	if (str && typeof str == "string")
		str = str.split("_").join(".");
	return str;
}

function getVersionNickname(versionStr, nickArr) {
	const ver = new Version(versionStr);
	let last = null;

	for (let i = 0, l = nickArr.length; i < l; i++) {
		if (nickArr[i][1].compare(ver) == 1)
			break;
		last = nickArr[i][0];
	}

	return last;
}
