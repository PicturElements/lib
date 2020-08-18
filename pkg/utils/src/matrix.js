import { padEnd } from "./str";

const matrix = {};

// Matrix generators
matrix.identity = n => {
	const mx = [];

	for (let i = 0; i < n; i++) {
		const row = [];

		for (let j = 0; j < n; j++)
			row.push(Number(i == j));

		mx.push(row);
	}

	return mx;
};

matrix.clone = mx => {
	const cloned = [];

	for (let i = 0, m = mx.length; i < m; i++)
		cloned.push(mx[i].slice());

	return cloned;
};

matrix.toMatrix = (val, clone = false) => {
	if (!Array.isArray(val)) {
		if (typeof val != "number")
			return [];

		return [[val || 0]];
	}

	if (!val.length)
		return [];

	if (Array.isArray(val[0])) {
		if (clone)
			return matrix.clone(val);

		return val;
	}

	const mx = [];
	for (let i = 0, m = val.length; i < m; i++) {
		if (typeof val[i] == "number")
			mx.push([val[i] || 0]);
		else
			mx.push([0]);
	}

	return mx;
};

// Matrix generators cont.: 2D transforms
matrix.two = {};

matrix.two.scale = (mx, xc, yc) => {
	return resolveTransform(mx, xc, yc, (x = 1, y = x) => [
		[x, 0],
		[0, y]
	]);
};

matrix.two.scaleX = (mx, xc) => {
	return resolveTransform(mx, xc, (x = 1) => [
		[x, 0],
		[0, 1]
	]);
};

matrix.two.scaleY = (mx, yc) => {
	return resolveTransform(mx, yc, (y = 1) => [
		[1, 0],
		[0, y]
	]);
};

matrix.two.rotate = (mx, th) => {
	return resolveTransform(mx, th, (t = 0) => [
		[Math.cos(t), Math.sin(t)],
		[-Math.sin(t), Math.cos(t)]
	]);
};

matrix.two.shearX = (mx, sh) => {
	return resolveTransform(mx, sh, (s = 0) => [
		[1, s],
		[0, 1]
	]);
};

matrix.two.shearY = (mx, sh) => {
	return resolveTransform(mx, sh, (s = 0) => [
		[1, 0],
		[s, 1]
	]);
};

// Matrix generators cont.: 3D transforms
matrix.three = {};

matrix.three.scaleX = (mx = null, c = 1) => {

};

matrix.three.scaleY = (mx = null, c = 1) => {

};

matrix.three.scaleZ = (mx = null, c = 1) => {

};

function resolveTransform(mx, ...args) {
	const builder = args.pop();

	if (typeof mx == "number") {
		for (let i = args.length - 1; i >= 0; i--)
			args[i + 1] = args[i];
		args[0] = mx;
		mx = null;
	}

	const out = builder(...args);
	if (!mx)
		return out;

	return matrix.multiply(mx, out);
}

// Elementary matrix operations
matrix.swap = (mx, m, m2) => {
	const tmpRow = mx[m];
	mx[m] = mx[m2];
	mx[m2] = tmpRow;
	return mx;
};

// Simple matrix operations
matrix.add = (mx, mx2) => {
	const [m, n] = matrix.dimensions(mx),
		[m2, n2] = matrix.dimensions(mx2);

	if (m != m2 || n != n2)
		return null;

	const out = [];

	for (let i = 0; i < m; i++) {
		const row = [];

		for (let j = 0; j < n; j++)
			row.push(mx[i][j] + mx2[i][j]);

		out.push(row);
	}
};

matrix.subtract = (mx, mx2) => {
	const [m, n] = matrix.dimensions(mx),
		[m2, n2] = matrix.dimensions(mx2);

	if (m != m2 || n != n2)
		return null;

	const out = [];

	for (let i = 0; i < m; i++) {
		const row = [];

		for (let j = 0; j < n; j++)
			row.push(mx[i][j] - mx2[i][j]);

		out.push(row);
	}
};

matrix.multiply = (mx, mx2) => {
	if (typeof mx == "number" || typeof mx2 == "number")
		return matrix.multiplyScalar(mx, mx2);

	const [m, n] = matrix.dimensions(mx),
		[m2, n2] = matrix.dimensions(mx2);

	if (n != m2)
		return null;

	const out = [];

	for (let i = 0; i < m; i++) {
		const row = [];

		for (let j2 = 0; j2 < n2; j2++) {
			let sum = 0;

			for (var j = 0; j < n; j++)
				sum += mx[i][j] * mx2[j][j2];

			row.push(sum);
		}

		out.push(row);
	}

	return out;
};

matrix.multiplyScalar = (mx, scalar) => {
	if (typeof mx == "number" && scalar == "number")
		return mx * scalar;

	if (typeof mx == "number") {
		const tmpScalar = mx;
		mx = scalar;
		scalar = tmpScalar;
	}

	const [m, n] = matrix.dimensions(mx),
		out = [];

	for (let i = 0; i < m; i++) {
		const row = [];

		for (let j = 0; j < n; j++)
			row.push(mx[i][j] * scalar);

		out.push(row);
	}

	return out;
};

// Non-trivial matrix operations
matrix.ref = (mx, clone = false, detailed = false) => {
	if (clone)
		mx = matrix.clone(mx);

	const [m, n] = matrix.dimensions(mx);
	let pr = 0,
		pc = 0,
		detC = 1;

	while (pr < m && pc < n) {
		const pivot = matrix.pivot(mx, pr, pc);

		if (mx[pivot, pc] == 0)
			pc++;
		else {
			if (pivot != pr) {
				matrix.swap(mx, pivot, pr);
				detC *= -1;
			}

			if (mx[pr][pc] == 0) {
				pr++;
				pc++;
				continue;
			}

			for (let i = pr + 1; i < m; i++) {
				const q = mx[i][pc] / mx[pr][pc];
				mx[i][pc] = 0;

				for (let j = pc + 1; j < n; j++)
					mx[i][j] -= mx[pr][j] * q;
			}

			pr++;
			pc++;
		}
	}

	if (!detailed)
		return mx;

	return {
		matrix: mx,
		detC
	};
};

matrix.rref = (mx, aug, clone = false, detailed = false) => {
	if (clone) {
		mx = matrix.clone(mx);
		aug = matrix.toMatrix(aug, true);
	} else
		aug = matrix.toMatrix(aug);

	const [m, n] = matrix.dimensions(mx),
		[m2, n2] = matrix.dimensions(aug);

	if (m != n || m2 != m) {
		if (!detailed)
			return null;
		
		return {
			matrix: mx,
			augmented: null,
			invertible: false
		};
	}

	let invertible = true;

	for (let i = 0; i < m; i++) {
		if (mx[i][i] == 0) {
			let swapped = false;

			for (let i2 = i + 1; i2 < m; i2++) {
				if (mx[i2][i] == 0)
					continue;

				matrix.swap(mx, i, i2);
				matrix.swap(aug, i, i2);
				swapped = true;
				break;
			}

			if (!swapped) {
				invertible = false;
				break;
			}
		}

		const c = 1 / mx[i][i];
		for (let j = 0; j < n; j++)
			mx[i][j] *= c;
		for (let j = 0; j < n2; j++)
			aug[i][j] *= c;

		for (let i2 = 0; i2 < m; i2++) {
			if (i2 == i)
				continue;

			const d = mx[i2][i];
			for (let j = i; j < n; j++)
				mx[i2][j] -= mx[i][j] * d;
			for (let j = 0; j < n2; j++)
				aug[i2][j] -= aug[i][j] * d;
		}
	}

	if (!detailed)
		return invertible ? aug : null;

	return {
		matrix: mx,
		augmented: invertible ? aug : null,
		invertible
	};
};

matrix.invert = (mx, clone = false, detailed = false) => {
	if (!matrix.isSquare(mx))
		return null;

	if (clone)
		mx = matrix.clone(mx);

	return matrix.rref(
		mx,
		matrix.identity(mx.length),
		false,
		detailed
	);
};

// Reducing operators
matrix.isSquare = mx => {
	return mx.length > 0 && mx.length == mx[0].length;
};

matrix.dimensions = mx => {
	if (!mx.length)
		return [0, 0];

	return [mx.length, mx[0].length];
};

matrix.pivot = (mx, pr, pc) => {
	const [m, n] = matrix.dimensions(mx);
	let idx = pr,
		max = Math.abs(mx[pr][pc]);

	if (pc >= n)
		return idx;

	for (let i = pr + 1; i < m; i++) {
		const c = Math.abs(mx[i][pc]);

		if (c > max) {
			idx = i;
			max = c;
		}
	}

	return idx;
};

matrix.det = mx => {
	if (!matrix.isSquare(mx))
		return 0;

	switch (mx.length) {
		case 2:
			return (mx[0][0] * mx[1][1]) - (mx[0][1] * mx[1][0]);

		case 3:
			return (mx[0][0] * mx[1][1] * mx[2][2]) +
				(mx[0][1] * mx[1][2] * mx[2][0]) +
				(mx[0][2] * mx[1][0] * mx[2][1]) -
				(mx[0][2] * mx[1][1] * mx[2][0]) -
				(mx[0][1] * mx[1][0] * mx[2][2]) -
				(mx[0][0] * mx[1][2] * mx[2][1]);

		default: {
			const eliminated = matrix.ref(mx, true, true);
			return matrix.mulTrace(eliminated.matrix) * eliminated.detC;
		}
	}
};

matrix.trace = mx => {
	if (!matrix.isSquare(mx))
		return 0;

	let sum = 0;

	for (let i = 0, m = mx.length; i < m; i++)
		sum += mx[i][i];

	return sum;
};

matrix.mulTrace = mx => {
	if (!matrix.isSquare(mx))
		return 0;

	let product = 1;

	for (let i = 0, m = mx.length; i < m; i++) {
		if (mx[i][i] == 0)
			return 0;

		product *= mx[i][i];
	}

	return product;
};

// Row operations
matrix.row = {};

matrix.row.pivot = row => {
	for (let j = 0, n = row.length; j < n; j++) {
		if (row[j] != 0)
			return j;
	}

	return 0;
};

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

matrix.print = printMatrix;

export {
	matrix,
	printMatrix
};
