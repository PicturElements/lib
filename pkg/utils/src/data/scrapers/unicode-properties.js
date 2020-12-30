export default async function scrape() {
	const out = {};
	const categories = [...document.querySelectorAll("table.table-striped tbody td:first-child")]
		.map(n => n.textContent.trim().replace(/\[|\]/g, ""));

	for (const category of categories) {
		const doc = document.createElement("div"),
			url = `https://www.fileformat.info/info/unicode/category/${category}/list.htm`;

		const response = await fetch(url);
		const html = await response.text();
		doc.innerHTML = html;

		out[category] = encode(getCodes(doc));
		console.log(`Scraped category ${category} at ${url}`);
	}

	return out;
}

function getCodes(doc) {
	return [...doc.querySelectorAll("table.table-striped tbody td:first-child")]
		.map(n => parseInt(n.textContent.trim().replace("U+", ""), 16))
		.sort((a, b) => a > b ? 1 : -1);
}

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

	return out.replace(/\\/g, "\\\\");
}
