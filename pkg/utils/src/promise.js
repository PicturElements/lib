import { isThenable } from "./is";

function then(value, onFulfilled, onRejected = null) {
	if (typeof onFulfilled != "function")
		return value;

	if (isThenable(value))
		return value.then(onFulfilled, onRejected);
	
	if (typeof onRejected == "function") {
		try {
			return onFulfilled(value);
		} catch {
			return onRejected(value);
		}
	}

	return onFulfilled(value);
}

export {
	then
};
