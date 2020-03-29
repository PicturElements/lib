import { hasOwn } from "@qtxr/utils";

export default {
	use({ wrapper }, partitionName = "events") {
		const data = wrapper.getInjectorPartition("data");
		
		if (!hasOwn(data, partitionName))
			data[partitionName] = [];
		else if (!Array.isArray(data[partitionName].constructor)) {
			console.warn(`Refuses to use events because component data already has a non-array property with key '${partitionName}'`);
			return false;
		}

		wrapper.addMethod("addEventListener", function(target, type, callback, options) {
			if (typeof callback != "function")
				return console.warn("Cannot add event listener: callback is not a function");
	
			const partition = this.$data[partitionName],
				vm = this,
				// Assumes that no event handler is called with more than the event as its args
				interceptingCallback = function(evt) {
					callback.call(this, evt, vm);
				};
	
			partition.push({
				target,
				type,
				callback: interceptingCallback,
				options
			});
	
			target.addEventListener(type, interceptingCallback, options);
			return _ => callback.call(null, null, vm);
		});

		wrapper.addHook("beforeDestroy", function() {
			const partition = this.$data[partitionName];
			partition.forEach(p => p.target.removeEventListener(p.type, p.callback, p.options));
		});
	},
	isUsable({ used }) {
		if (!used)
			return true;

		console.warn("Events cannot be used more than once because only one event partition and a singular method are allowed to be initiated");
		return false;
	}
};
