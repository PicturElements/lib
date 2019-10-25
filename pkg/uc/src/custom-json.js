import {
	from,
	isObject,
	matchType,
	resolveArgs,
	binarySearch,
	getGlobalScope,
	getFunctionName,
	isNativeFunction,
	circulate,
	uncirculate,
	getCircularId,
	setCircularId
} from "@qtxr/utils";

const stockTransformers = [
	{
		// NEVER rename this or any stock transformers
		name: "general",
		priority: 0,
		match: "function|bigint|object",
		replace(value, wrap) {
			if (value == null)
				return value;

			switch (typeof value) {
				// There's no guarantee that functions can be reliably serialized,
				// as closures, function locations, etc. aren't preserved.
				// Ideally, functions shouldn't be serialized at all
				case "function":
					if (isNativeFunction(value))
						return wrap("nativeFunction", getFunctionName(value));
					
					return wrap("function", `return ${value.toString()}`);

				case "bigint":
					return wrap("bigint", value.toString());
			}

			switch (value.constructor) {
				case RegExp:
					return wrap({
						type: "regex",
						source: value.source,
						flags: value.flags
					});

				case Array: {
					const circularId = getCircularId(value);

					if (circularId > -1) {
						return wrap({
							type: "circularArray",
							id: circularId,
							value
						});
					}

					break;
				}
			}

			if (typeof Map != "undefined" && value instanceof Map)
				return wrap("map", from(value));
			if (typeof Set != "undefined" && value instanceof Set)
				return wrap("set", from(value));

			return value;
		},
		// NEVER remove functions from this - this is crucial
		// for backwards compatibility
		revive: {
			function: packet => Function(packet.value)(),
			nativeFunction(packet) {
				const globalScope = getGlobalScope();
				
				if (!(packet.value in globalScope)) {
					console.warn(`Global scope doesn't have a function by name '${packet.value}' - falling back to noop`, packet);
					return noop => noop;
				}

				return globalScope[packet.value];
			},
			bigint(packet) {
				if (typeof BigInt == "undefined") {
					console.warn("BigInt is not supported - falling back to Number", packet);
					return Number(packet.value);
				}

				return BigInt(packet.value);
			},
			regex: packet => new RegExp(packet.source, packet.flags),
			map(packet) {
				if (typeof Map == "undefined") {
					console.warn("Map is not supported - falling back to raw key-value array", packet);
					return packet.value;
				}

				return new Map(packet.value);
			},
			set(packet) {
				if (typeof Set == "undefined") {
					console.warn("Set is not supported - falling back to raw array", packet);
					return packet.value;
				}

				return new Set(packet.value);
			},
			circularArray(packet) {
				const arr = packet.value;
				setCircularId(arr, packet.id);
				return arr;
			}
		}
	}
];

const constructorParams = [
	{ name: "transformers", type: Array, default: stockTransformers },
	{ name: "useStockTransformers", type: "boolean", default: false }
];

export default class CustomJSON {
	constructor(...args) {
		let {
			transformers,
			useStockTransformers
		} = resolveArgs(args, constructorParams, "allowSingleSource");

		this.replacers = [];
		this.revivers = {};
		this.reviverSets = {};

		if (useStockTransformers && transformers != stockTransformers)
			transformers = transformers.concat(stockTransformers);

		for (let i = 0, l = transformers.length; i < l; i++)
			this.addTransformer(transformers[i]);
	}

	stringify(data, space, isCircular = false) {
		const inst = this;

		if (isCircular) {
			const uncirc = uncirculate(data);

			return JSON.stringify(uncirc, function(key, value) {
				return runReplace(inst, key, value, this);
			}, space);
		}

		// First try stringifying the data as-is. If that fails,
		// try again but uncirculate the data before use
		try {
			return JSON.stringify(data, function(key, value) {
				return runReplace(inst, key, value, this);
			}, space);
		} catch (e) {
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
			if (e instanceof RangeError || (e instanceof TypeError && /circular|cyclic/i.test(e.message))) {
				console.warn("Found circular structure in input data; trying again. If you see this message frequently, consider explicitly enabling circular input support with the isCircular flag", data);
				return this.stringify(data, space, true);
			}

			throw e;
		}
	}

	parse(str) {
		const data = JSON.parse(str, (key, value) => {
			if (!isObject(value))
				return value;

			return runRevive(this, key, value);
		});

		return circulate(data);
	}

	addTransformer(transformer) {
		if (!isObject(transformer))
			throw new TypeError("Invalid transformer: replacer is not an object");
		if (!transformer.name || typeof transformer.name != "string")
			throw new Error("Invalid transformer: name must be a truthy string");
		if (this.revivers.hasOwnProperty(transformer.name))
			throw new Error(`Invalid transformer: transformer by name '${transformer.name}' is already in use`);
		if (!isObject(transformer.revive))
			throw new Error("Invalid transformer: reviver must be an object");

		const replacer = {
			name: transformer.name,
			priority: transformer.priority || 0,
			match: transformer.match,
			replace: transformer.replace
		};

		const reviverSet = {
			name: transformer.name,
			revivers: transformer.revive
		};

		const insertIdx = binarySearch(this.replacers, r => r.priority - replacer.priority) + 1,
			revivers = reviverSet.revivers;
		this.replacers.splice(insertIdx, 0, replacer);
		this.reviverSets[transformer.name] = reviverSet;

		for (const k in revivers) {
			if (!revivers.hasOwnProperty(k))
				continue;

			this.revivers[getReviverKey(transformer.name, k)] = revivers[k];
		}
	}

	removeTransformer(name) {
		if (typeof name != "string" || !this.reviverSets.hasOwnProperty(name))
			return false;

		// Remove replacer
		for (let i = 0, l = this.replacers.length; i < l; i++) {
			if (this.replacers[i].name == name) {
				this.replacers.splice(i, 1);
				break;
			}
		}

		// Remove revivers
		const revivers = this.reviverSets[name].revivers;
		for (const k in revivers)
			delete this.revivers[getReviverKey(name, k)];

		delete this.reviverSets[name];

		return true;
	}
}

// NEVER edit these for backwards compatibility
const reviverKeyKey = "___@qtxr/uc/custom-json:type";

function runReplace(inst, key, value, owner) {
	wrapReplacer.setRuntime(key, value, owner);

	// Don't run on processed data
	if (owner.hasOwnProperty(reviverKeyKey))
		return value;

	for (let i = 0, l = inst.replacers.length; i < l; i++) {
		const replacer = inst.replacers[i];

		if (replacer.match && !matchType(value, replacer.match, "falseDefault"))
			continue;

		wrapReplacer.transformerName = replacer.name;
		const retVal = replacer.replace(value, wrapReplacer);
		if (retVal != value)
			return retVal;
	}

	return value;
}

function runRevive(inst, key, value) {
	if (!value.hasOwnProperty(reviverKeyKey))
		return value;

	const reviverKey = value[reviverKeyKey],
		reviver = inst.revivers[reviverKey];

	if (typeof reviver != "function")
		throw new TypeError(`Reviver with name '${reviverKey}' not found`);

	return reviver(value);
}

function wrapReplacer(typeOrPacket, valueOrReplacer) {
	const type = typeof typeOrPacket == "string" ?
		typeOrPacket :
		typeOrPacket && typeOrPacket.type;

	if (!type || typeof type != "string")
		throw new Error("Invalid packet: type must be a truthy string");

	let packet;

	if (typeof typeOrPacket == "string") {
		packet = {};

		if (typeof valueOrReplacer == "function") {
			packet.value = valueOrReplacer(
				wrapReplacer.key,
				wrapReplacer.value,
				wrapReplacer.owner
			);
		} else
			packet.value = valueOrReplacer;
	} else {
		if (!isObject(typeOrPacket))
			throw new TypeError("Invalid packet: packet is not an object");

		packet = Object.assign({}, typeOrPacket);
		delete packet.type;
	}

	packet[reviverKeyKey] = getReviverKey(wrapReplacer.transformerName, type);

	return packet;
}

wrapReplacer.key = null;
wrapReplacer.value = null;
wrapReplacer.owner = null;
wrapReplacer.transformerName = null;

wrapReplacer.setRuntime = (key, value, owner) => {
	wrapReplacer.key = key;
	wrapReplacer.value = value;
	wrapReplacer.owner = owner;
};

function getReviverKey(transformerName, type) {
	return `${transformerName}:${type}`;
}
