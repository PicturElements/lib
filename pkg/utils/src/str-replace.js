function cleanPath(str) {
	return escape(str).replace(/(\])/g, "\\$&");
}

function escape(str) {
	return str.replace(/['"`\\]/g, match => `\\${match}`);
}

function unescape(str) {
	return String(str).replace(/\\(.)/g, "$1");
}

export {
	cleanPath,
	escape,
	unescape
};
