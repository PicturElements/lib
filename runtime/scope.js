const scope = {};

function expose(name, value) {
	scope[name] = value;
}

export {
	expose
};