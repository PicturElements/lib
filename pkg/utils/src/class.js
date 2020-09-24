import {
	isObject,
	isValidIdentifier,
	isNativeConstructor,
	isNativeFunction
} from "./is";
import { sym } from "./sym";
import { untab } from "./str";
import { anyOf } from "./obj";
import supports from "./supports";
import hasOwn from "./has-own";
import resolveArgs from "./resolve-args";
import getFunctionName from "./get-function-name";
import forEach from "./for-each";

const CLASS_CONFIG = sym("class config"),
	HAS_NATIVE_CONSTRUCTOR = sym("has native constructor");

const mkClass = supports.keywords.class ?
	(nameOrConfig, configOrConstructor = null) => {
		const c = mkConfig(nameOrConfig, configOrConstructor),
			constr = hasOwn(c, "constructor") ?
				c.constructor :
				null,
			superC = anyOf(c)("super", "extends");
		let cls = null;

		if (!isValidIdentifier(c.name))
			throw new Error(`Cannot make class: invalid class name '${c.name}'`);

		if (superC) {
			const sup = isObject(superC) ?
				mkClass(superC) :
				superC;
			let n = getFunctionName(sup);

			if (n == "config" || n == "constr" || n == "resArgs" || n == "resSuperArgs")
				n = "_" + n;

			if (!isValidIdentifier(n))
				n = "PlaceholderClass";

			cls = fn(
				n,
				"config",
				"constr",
				"resArgs",
				"resSuperArgs",
				`
					return class ${c.name} extends ${n} {
						constructor(...args) {
							super(...resSuperArgs(null, args, ${n}, config));

							if (typeof constr == "function")
								constr.apply(this, resArgs(this, args, config));
						}
					}
				`
			)(sup, c, constr, resArgs, resSuperArgs);
		} else if (typeof constr == "function") {
			cls = fn(
				"config",
				"constr",
				"resArgs",
				`
					return class ${c.name} {
						constructor(...args) {
							constr.apply(this, resArgs(this, args, config));
						}
					}
				`
			)(c, constr, resArgs);
		} else
			cls = fn(`return class ${c.name} {}`)();

		addProps(cls, c);
		return cls;
	} :
	(nameOrConfig, configOrConstructor = null) => {
		const c = mkConfig(nameOrConfig, configOrConstructor),
			constr = hasOwn(c, "constructor") ?
				c.constructor :
				null,
			superC = anyOf(c)("super", "extends");
		let cls = null;

		if (!isValidIdentifier(c.name))
			throw new Error(`Cannot make class: invalid class name '${c.name}'`);

		const newCheck = `if (!this || !(this instanceof ${c.name})) throw new TypeError("constructor ${c.name} cannot be invoked without 'new'");`;

		if (superC) {
			const sup = isObject(superC) ?
					mkClass(superC) :
					superC,
				hasNativeC = hasNativeConstructor(sup),
				wrappedSuper = wrapConstructor(sup),
				thisRef = hasNativeC ?
					"_this" :
					"this";

			cls = fn(
				"sup",
				"config",
				"constr",
				"superConstr",
				"resArgs",
				"resSuperArgs",
				`
					return function ${c.name}() {
						var _this = superConstr.apply(this, resSuperArgs(null, arguments, sup, config));

						if (typeof constr == "function")
							constr.apply(${thisRef}, resArgs(${thisRef}, arguments, config));

						return _this;
					}
				`
			)(wrappedSuper, c, constr, wrappedSuper.prototype.constructor, resArgs, resSuperArgs);

			cls[HAS_NATIVE_CONSTRUCTOR] = hasNativeC;
			setPrototype(cls, wrappedSuper);
		} else if (typeof constr == "function") {
			cls = fn(
				"config",
				"constr",
				"resArgs",
				`
					return function ${c.name}() {
						${newCheck}
						constr.apply(this, resArgs(this, arguments, config));
					}
				`
			)(c, constr, resArgs);
		} else
			cls = fn(`return function ${c.name}() {${newCheck}}`)();

		addProps(cls, c);
		return cls;
	};

function mkConfig(name, config) {
	if (isObject(name))
		return name;

	if (typeof config == "function") {
		return {
			name: name || "",
			constructor: config
		};
	}

	return Object.assign({
		name: name || ""
	}, config);
}

function fn(...args) {
	const functionBody = args.pop();

	return Function(
		...args,
		untab(functionBody, true)
	);
}

function resArgs(inst, args, config) {
	if (typeof config.resolveArgs == "function")
		return config.resolveArgs.call(inst, args, config) || [];

	if (!config.parameters)
		return args;

	return resolveArgs(args, config.parameters, "returnArgList|omitRest");
}

function resSuperArgs(inst, args, sup, config) {
	if (typeof config.superResolveArgs == "function")
		return config.superResolveArgs.call(inst, args, config) || [];
	if (typeof config.resolveArgs == "function")
		return config.resolveArgs.call(inst, args, config) || [];

	let params = null;
	if (config.superParameters)
		params = config.superParameters;
	else if (hasOwn(sup, CLASS_CONFIG)) {
		if (typeof sup[CLASS_CONFIG].resolveArgs == "function")
			return sup[CLASS_CONFIG].resolveArgs.call(inst, args, sup[CLASS_CONFIG]);

		params = sup[CLASS_CONFIG].parameters;
	}

	if (!params || !config.parameters) {
		if (config.parameters)
			return resolveArgs(args, config.parameters, "returnArgList|omitRest");
		else
			return args;
	}

	const localArgs = resolveArgs(args, config.parameters, "omitRest"),
		resolvedArgs = [];

	for (let i = 0, l = params.length; i < l; i++) {
		if (!hasOwn(localArgs, params[i].name))
			throw new ReferenceError(`Cannot call superclass ${getFunctionName(sup)}: parameter by name '${params[i].name}' cannot be found`);

		resolvedArgs.push(localArgs[params[i].name]);
	}

	return resolvedArgs;
}

function addProps(cls, config) {
	const mount = (target, source, node = "descriptor") => {
		if (!source)
			return;

		const props = collect(source, node);
		Object.defineProperties(target, props);
	};

	mount(cls.prototype, config.proto || config.prototype);
	mount(cls, config.static);
	mount(cls.prototype, config.computedProto || config.computed, "raw");
	mount(cls, config.computedStatic, "raw");
	cls[CLASS_CONFIG] = config;
}

function collect(source, mode = "descriptor", acc = {}) {
	if (Array.isArray(source)) {
		for (let i = 0, l = source.length; i < l; i++)
			collect(source[i], acc);
	} else if (isObject(source)) {
		forEach(source, (value, key) => {
			switch (mode) {
				case "descriptor":
					acc[key] = Object.getOwnPropertyDescriptor(source, key);
					break;

				case "raw":
					acc[key] = value;
					break;
			}
		}, "overSymbols");
	}

	return acc;
}

function setPrototype(sub, sup) {
	sub.prototype = Object.create(
		sup.prototype,
		{
			constructor: {
				value: sub,
				writable: true,
				configurable: true
			}
		}
	);

	return sub;
}

// Adapted from the Babel implementation
function wrapConstructor(constr) {
	if (!isNativeConstructor(constr))
		return constr;

	return Object.setPrototypeOf(
		function NativeConstructorWrapper() {
			return construct(constr, arguments, Object.getPrototypeOf(this).constructor);
		},
		constr
	);
}

const construct = typeof Reflect != "undefined" ?
	Reflect.construct :
	(sup, args, sub) => Object.setPrototypeOf(
		new (Function.bind.apply(sup, [null, ...args]))(),
		sub.prototype
	);

function hasNativeConstructor(sup) {
	return isNativeFunction(sup) || (hasOwn(sup, HAS_NATIVE_CONSTRUCTOR) && sup[HAS_NATIVE_CONSTRUCTOR]);
}

export {
	mkClass
};