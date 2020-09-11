import { repeat } from "@qtxr/utils";

export default {
	ADDITION: [
		// Python-esque list concatenation
		{
			left: Array,
			right: Array,
			run: (l, r) => l.concat(r)
		}
	],
	MULTIPLICATION: [
		// Python-esque string repetition
		{
			left: "string",
			right: "number",
			reversible: true,
			run: (l, r) => repeat(l, r)
		},
		// ...and list repetition
		{
			left: Array,
			right: "number",
			reversible: true,
			run: (l, r) => {
				const out = [],
					len = l.length;
	
				while (r--) {
					for (let i = 0; i < len; i++)
						out.push(l[i]);
				}
	
				return out;
			}
		}
	]
};
