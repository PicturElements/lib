import {
	get,
	hasOwn,
	isNativeSimpleObject
} from "@qtxr/utils";

const dynArgRegex = /^<<\s*(.+?)\s*>>$/;

// Middleware between constructor and instance.
// This function allows you to specify a constructor and arguments,
// and upon invocation of its instantiate method, it creates an instance
// from said constructor with the specified arguments. This adds support
// for instance variables in template data without the need to share an
// instance between instances using the template.
export default class Instantiator {
	constructor(constr, ...args) {
		this.constr = constr;
		this.args = args;
		this.dynamicArgs = {};
	}

	setDynamicArgs(args) {
		this.dynamicArgs = args || {};
	}

	instantiate(...args) {
		args = [...this.args, ...args];

		for (let i = 0, l = args.length; i < l; i++) {
			const arg = args[i];

			if (typeof arg == "string") {
				const ex = dynArgRegex.exec(arg);

				if (!ex)
					continue;

				args[i] = get(this.dynamicArgs, ex[1]);
			}
		}

		return new this.constr(...args);
	}
}

function applyInstantiators(obj, dynamicArgs) {
	if (!isNativeSimpleObject(obj))
		return obj;

	for (let k in obj) {
		if (hasOwn(obj, k)) {
			if (obj[k] instanceof Instantiator) {
				obj[k].setDynamicArgs(dynamicArgs);
				obj[k] = obj[k].instantiate();
			} else
				applyInstantiators(obj[k], dynamicArgs);
		}
	}

	return obj;
}

export {
	applyInstantiators
};
