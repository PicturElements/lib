import {
	sym,
	inject,
	apply
} from "@qtxr/utils";

const contexts = {},
	proto = CanvasRenderingContext2D.prototype,
	defaultConfig = {
		modifiers: {}
	};

// CTX2D intercepts a normal CanvasRenderingContext2D instance and acts as a proxy.
// Everything that gets accessed on CTX2D gets passed to the reference context,
// but it also collects data that's passed into the canvas function, whereby
// it's possible to generate meta data for the graph automatically, or by simply
// appending .save() to the canvas function call.
export default class CTX2D {
	constructor(ctx, owner, customProps, config) {
		const symbol = sym("CTX2D");
		customProps = customProps || {};
		contexts[symbol] = {
			stock: ctx,
			custom: customProps
		};
		this.config = inject(config, defaultConfig, {
			cloneExtender: true
		});
		this.sym = symbol;
		this.index = [];
		this.item = {};
		this.owner = owner;
	}

	log(log, dataPoint) {
		this.item = {};
		this.index.push(this.item);

		apply(this, this.config.modifiers.log, this.item, this.owner);

		this.add(log);

		if (dataPoint)
			this.item.data = dataPoint;
	}

	add(data) {
		if (typeof data != "object")
			return;

		for (let k in data) {
			if (hasOwn(data, k))
				this.item[k] = data[k];
		}

		apply(this, this.config.modifiers.add, this.item, this.owner);
	}

	purgeIndex() {
		this.index = [];
		this.item = {};
		return this;
	}

	destroy() {
		// More manual but better support than WeakMap
		delete contexts[this.sym];
		delete this.dataset;
	}
}

(_ => {
	for (let k in proto) {
		if (hasOwn(proto, k))
			setProto(k);
	}

	function setProto(key) {
		let setGetter = false;

		// Properties on crc2d's prototype are either built-in functions
		// or getters/setters. Functions can be accessed as normal, but
		// getters/setters need the context value to be a crc instance, not
		// crc itself, and so it throws an error.
		try {
			proto[key];
		} catch (e) {
			setGetter = true;
		}

		if (setGetter) {
			Object.defineProperty(CTX2D.prototype, key, {
				set(val) {
					const c = contexts[this.sym];

					if (hasOwn(c.custom, key))
						c.custom[key] = val;
					else
						c.stock[key] = val;
				},
				get() {
					const c = contexts[this.sym];
					return (hasOwn(c.custom, key) ? c.custom : c.stock)[key];
				}
			});
		} else {
			CTX2D.prototype[key] = function() {
				const c = contexts[this.sym],
					ret = (hasOwn(c.custom, key) ? c.custom : c.stock)[key]
						.apply(c.stock, arguments);

				return ret || this;
			};
		}
	}
})();
