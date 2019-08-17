const startTime = Date.now();
const getTime = typeof performance == "undefined" || typeof performance.now == "undefined" ? (offs = 0) => {
	return Date.now() - startTime - offs;
} : (offs = 0) => {
	return performance.now() - offs;
};

const requestFrame = typeof requestAnimationFrame == "undefined" ? func => {
	func(getTime());
} : requestAnimationFrame;

export default {
	getTime,
	requestFrame
};
