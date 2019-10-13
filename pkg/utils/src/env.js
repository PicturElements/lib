function getEnvType() {
	if (typeof process == "object" && typeof process.env == "object")
		return "node";
		
	if (typeof self == "object" && typeof WorkerGlobalScope == "function" && self instanceof WorkerGlobalScope && typeof document != "object")
		return "worker";

	if (typeof window == "object" && typeof Window == "function" && window instanceof Window && typeof document == "object")
		return "window";

	return "shell";
}

function getGlobalScope() {
	switch (getEnvType()) {
		case "node":
		case "shell":
			return global;
		case "worker":
			return self;
		case "window":
			return window;
	}
}

export {
	getEnvType,
	getGlobalScope
};
