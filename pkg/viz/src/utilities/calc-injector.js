export default class CalcInjector {
	constructor() {
		this.partitions = {};
		this.injectorData = {
			partition: null,
			injector: null,
			args: [],
			for: null,
			when: true
		};
	}

	registerInjectorPartition(partition) {
		if (this.partitions.hasOwnProperty(partition))
			throw new Error(`Injector partition '${partition}' is already in use`);
		if (!partition)
			throw new Error("Injector partition must have a valid name");
			
		this.partitions[partition] = new Map();
	}

	at(partition) {
		if (!this.partitions.hasOwnProperty(partition)) {
			console.error("Partition does not exist in injector");
			return this;
		}

		this.injectorData.partition = this.partitions[partition];
		return this;
	}

	pass(...args) {
		this.injectorData.args = args;
		return this;
	}

	for(func) {
		let forVal = func;

		if (typeof func == "function")
			forVal = func(...this.injectorData.args);

		this.injectorData.for = forVal;

		return this;
	}

	when(validator) {
		this.injectorData.when = validator;
		return this;
	}

	inject(injector) {
		if (this.injectorData.for === null)
			throw new Error("Injector does not point to a reference value. Use .for()");
		if (this.injectorData.partition === null)
			throw new Error("Injector does not point to an injector partition. Use .at()");
		if (typeof injector != "function")
			throw new Error("Injector is not a function");

		this.resolvePartition(this.injectorData.partition);

		const when = this.injectorData.when,
			doNow = (typeof when == "function") ? when(...this.injectorData.args) : when;

		if (doNow)
			injector(...this.injectorData.args);
		else {
			this.injectorData.injector = injector;
			this.injectorData.partition.set(this.injectorData.for, this.injectorData);
		}

		this.injectorData = {
			partition: null,
			injector: null,
			args: [],
			for: null,
			when: true
		};
	}

	resolvePartition(partition) {
		partition.forEach((k, v) => {
			const doNow = (typeof v.when == "function") ? v.when(...v.args) : v.when;
			if (doNow) {
				v.injector(...v.args);
				partition.delete(k);
			}
		});
	}
}
