import { resolveFunc } from "../func";
import getConstructorName from "../get-constructor-name";

const type = {
	getNativeCode: resolveFunc(_ => {
		const PROMISE = typeof Promise != "undefined" ? Promise : null,
			SET = typeof Set != "undefined" ? Set : null,
			MAP = typeof Map != "undefined" ? Map : null,
			WEAKMAP = typeof WeakMap != "undefined" ? WeakMap : null,
			WEAKSET = typeof WeakSet != "undefined" ? WeakSet : null,
			PROXY = typeof Proxy != "undefined" ? Proxy : null,
			ABUF = typeof ArrayBuffer != "undefined" ? ArrayBuffer : null,
			I8A = typeof Int8Array != "undefined" ? Int8Array : null,
			UI8A = typeof Uint8Array != "undefined" ? Uint8Array : null,
			UI8CA = typeof Uint8ClampedArray != "undefined" ? Uint8ClampedArray : null,
			I16A = Int16Array != "undefined" ? Int16Array : null,
			UI16A = typeof Uint16Array != "undefined" ? Uint16Array : null,
			I32A = typeof Int32Array != "undefined" ? Int32Array : null,
			UI32A = typeof Uint32Array != "undefined" ? Uint32Array : null,
			F32A = typeof Float32Array != "undefined" ? Float32Array : null,
			F64A = typeof Float64Array != "undefined" ? Float64Array : null,
			BI64A = typeof BigInt64Array != "undefined" ? BigInt64Array : null,
			BUI64A = typeof BigUint64Array != "undefined" ? BigUint64Array : null;

		return constr => {
			if (typeof constr != "function" || constr == null)
				return null;

			switch (constr) {
				// Cross-browser compatible constructors
				case Object: return "object";
				case Array: return "array";
				case RegExp: return "regex";
				case Date: return "date";
				case Error: return "error";

				// Constructors with spotty browser support
				case PROMISE: return "promise";
				case SET: return "set";
				case MAP: return "map";
				case WEAKMAP: return "weakmap";
				case WEAKSET: return "weakset";
				case PROXY: return "proxy";
				case ABUF: return "arraybuffer";
				case I8A: return "int8array";
				case UI8A: return "uint8array";
				case UI8CA: return "uint8clampedarray";
				case I16A: return "int16array";
				case UI16A: return "uint16array";
				case I32A: return "int32array";
				case UI32A: return "uint32array";
				case F32A: return "float32array";
				case F64A: return "float64array";
				case BI64A: return "bigint64array";
				case BUI64A: return "biguint64array";
			}
		};
	}, "getNativeCode"),
	of(value, protoDepth = 0) {
		if (typeof value == "object") {
			if (value == null)
				return "null";

			const nc = type.getNativeCode(value.constructor);
			if (nc == "object") {
				return value.callee && String(value) == "[object Arguments]" ?
					"arguments" :
					"object";
			} else if (nc)
				return nc;

			if (protoDepth) {
				protoDepth = protoDepth === true ?
					Infinity :
					protoDepth;

				let proto = value;

				while (true) {
					proto = Object.getPrototypeOf(proto);

					if (proto.constructor != value.constructor)
						return type.of(proto, protoDepth - 1);
				}
			}

			return getConstructorName(value)
				.toLowerCase()
				.replace(/\s*/g, "");
		}

		return typeof value;
	}
};

export default type;
