// API:
// convert accepts a lookup table, which is structured as follows:
// {
//		// Objects may be used to define a correspondence. In this case,
//		// the key is the unit from which to convert and the children
//		// provide the unit to which the value should be converted
//		corr: {
//			// Using a number, the conversion is obtained by multiplying the input value
//			// with the conversion quotient (converted = val * quot)
//			quot: <number>,
//			// using a function, the conversion is obtained by calling it with
//			// the value, reference unit, and target unit
//			getter: <function>
//		},
//		// Derived properties may also be used. In this case,
//		// the derived value refers to a correspondence object
//		// and when a conversion is made, the conversion factor
//		// from the reference unit to the correspondent unit is obtained.
//		// Then, the conversion is made from the correspondence unit to
//		// the target unit with the ceonversion factor from the first conversion
//		// multiplied with the input value
//		derived: <string>
// }

function convert(lookup, val, from, to) {
	if (from == to)
		return val;

	if (!lookup.hasOwnProperty(from))
		return null;

	const fromPart = lookup[from];

	switch (typeof fromPart) {
		case "object": {
			if (!fromPart || !fromPart.hasOwnProperty(to))
				return null;

			const conv = fromPart[to];

			if (typeof conv == "function")
				return conv(val, from, to);

			return val * conv;
		}

		case "string": {
			const refConv = 1 / convert(lookup, 1, fromPart, from);
			return convert(lookup, val * refConv, fromPart, to);
		}
	}

	return null;
}

function mkConverter(lookup) {
	return convert.bind(null, lookup);
}

export {
	convert,
	mkConverter
};
