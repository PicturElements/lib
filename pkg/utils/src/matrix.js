import { padEnd } from "./str";

function printMatrix(matrix, options) {
	let {
		width: w = null,
		height: h = null,
		placeholder = ".",
		pad = 1,
		resolve = null
	} = options;

	if (!matrix.length || w === 0 || h === 0)
		return "";

	placeholder = String(placeholder);
	resolve = typeof resolve == "function" ? resolve : null;

	const outMatrix = [],
		maxLengths = [];

	if (typeof w == "number" && !Array.isArray(matrix[0])) {
		const len = matrix.length,
			fullLen = typeof h == "number" ?
				w * h :
				Math.ceil(len / w) * w;
		let row = [];

		for (let i = 0; i < w; i++)
			maxLengths.push(0);

		for (let i = 0; i < fullLen; i++) {
			let value = i >= len ?
				placeholder :
				matrix[i];

			if (value === undefined && !resolve)
				value = placeholder;
			else if (resolve)
				value = String(resolve(value));
			else
				value = String(value);

			if (value.length > maxLengths[i % w])
				maxLengths[i % w] = value.length;

			row.push(value);

			if (i % w == w - 1) {
				outMatrix.push(row);
				row = [];
			}
		}
	} else {
		const height = typeof h == "number" ?
			h :
			matrix.length;
		let width = typeof w == "number" ?
			w :
			0;

		for (let i = 0, l = matrix.length; i < l; i++) {
			if (matrix[i].length > width)
				width = matrix[i].length;
		}

		for (let i = 0; i < width; i++)
			maxLengths.push(0);

		for (let i = 0; i < height; i++) {
			const row = [];

			for (let j = 0; j < width; j++) {
				let value = i >= matrix.length || j >= matrix[i].length ?
					placeholder :
					matrix[i][j];

				if (value === undefined && !resolve)
					value = placeholder;
				else if (resolve)
					value = String(resolve(value));
				else
					value = String(value);

				if (value.length > maxLengths[j])
					maxLengths[j] = value.length;

				row.push(value);
			}

			outMatrix.push(row);
		}
	}

	let out = "";

	for (let i = 0, l = outMatrix.length; i < l; i++) {
		const row = outMatrix[i],
			len = row.length;

		for (let j = 0; j < len; j++) {
			out += j < len - 1 ?
				padEnd(row[j], maxLengths[j] + pad) :
				row[j] + "\n";
		}
	}

	return out;
}

export {
	printMatrix
};
