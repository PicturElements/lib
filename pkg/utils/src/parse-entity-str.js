const entityCache = Object.create(null),
	entityResolveElem = document.createElement("div");

// This function is quite ugly, but is roughly twice as performant
// as equivalent strategies like setting and reading innerHTML on an
// element directly while not requiring a database of entities
export default function parseEntityStr(str) {
	let outStr = "",
		match = "",
		code = 0,
		matchMode = 0;
	
	const push = _ => {
		if (matchMode == 1)
			outStr += String.fromCharCode(code);
		else {
			const item = entityCache[match];

			if (item)
				outStr += item;
			else {
				entityResolveElem.innerHTML = match;
				const resolved = entityResolveElem.textContent;
				entityCache[match] = resolved;
				outStr += resolved;
			}
		}

		matchMode = 0;
		match = "";
	};

	for (let i = 0, l = str.length; i < l; i++) {
		const c = str[i];

		if (c == "&") {
			if (matchMode)
				push();

			match = "&";
			code = 0;
			matchMode = 2;
		} else if (!matchMode)
			outStr += c;
		else switch (c) {
			case "#":
				if (match.length != 1) {
					outStr += match;
					match = "";
					matchMode = 0;
				} else {
					match += c;
					matchMode = 1;
				}

				code = 0;
				break;

			case ";":
				match += c;
				push();
				break;

			default:
				if (matchMode == 1) {
					const digit = Number(c);

					if (isNaN(digit))
						matchMode = 2;
					else
						code = code * 10 + digit;

					match += c;
				} else {
					const charCode = c.charCodeAt(0);

					if ((charCode > 64 && charCode < 91) || (charCode > 96 && charCode < 123))
						match += c;
					else {
						push();
						outStr += c;
					}
				}
		}
	}

	if (matchMode)
		push();

	return outStr;
}
