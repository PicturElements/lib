export default class Version {
	constructor(verStr, nickname, prefix) {
		verStr = verStr || "";
		this.version = verStr;
		this.nickname = nickname || null;
		this.prefix = prefix || null;
		this.versionArr = getVersionArr(verStr);
	}

	compare(ver) {
		const versionArr = (ver instanceof Version) ? ver.versionArr : getVersionArr(ver),
			len = Math.min(versionArr.length, this.versionArr.length);

		for (let i = 0; i < len; i++) {
			const a = this.versionArr[i] || 0,
				b = versionArr[i] || 0;

			if (a != b)
				return a > b ? 1 : -1;
		}

		return 0;
	}

	toString(plain) {
		if (this.nickname && !plain)
			return this.nickname;

		const ver = this.versionArr.join(".");

		return ver;
	}
}

function getVersionArr(str) {
	str = str || "0.0.0";
	let arr = str.split(".").map(Number);

	if (arr.length == 1 && typeof arr[0] != "number")
		arr = [0, 0, 0];

	return arr;
}
