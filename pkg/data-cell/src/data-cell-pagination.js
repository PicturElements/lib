import DataCell from "./data-cell";
import {
	get,
	inject,
	isObject,
	mergesort,
	isFiniteNum
} from "@qtxr/utils";

const PROCESSSOR_OPTIONS = {
	processors: {},
	transformers: {
		sequence(proc) {
			if (typeof proc == "string")
				return (cell, data) => get(data, proc);
			else if (Array.isArray(proc)) {
				const [ accessor, processor ] = proc;
			
				return (cell, data) => {
					const val = get(data, accessor);

					if (typeof processor == "function")
						return processor(cell, data, val);

					return val;
				};
			}

			return proc;
		}
	}
};

const STATE_TRANSFORMS = {
	page({ value, newState }) {
		newState.offset = newState.pageSize * value;
	},
	pageSize({ value, oldValue, newState, state }) {
		const page = Math.floor((oldValue * state.page) / value);
		newState.page = page;
		newState.offset = page * value;
	},
	offset({ value, newState }) {
		newState.page = Math.floor(value / newState.pageSize);
	}
};

export default class DataCellPagination extends DataCell {
	constructor(config = {}, initConfig = {}) {
		initConfig = inject({
			partitionClassifier: {
				pageSize: "garbage",
				page: "garbage",
				length: "garbage"
			},
			defaultState: {
				pageSize: config.pageSize || 25,
				page: config.page || 0,
				offset: (config.pageSize || 25) * (config.page || 0),
				total: config.total || Infinity,
				fetchedLength: 0
			},
			stateTransforms: STATE_TRANSFORMS,
			processorOptions: PROCESSSOR_OPTIONS
		}, initConfig, "override");

		super(config, initConfig);

		this.meta = {
			useSequencing: this.processors.hasOwnProperty("sequence"),
			useTagging: this.processors.hasOwnProperty("tag"),
			maxSequence: null
		};

		this.data = getPaginationDataStruct(this);
		this.isPartitioned = !Array.isArray(this.data);
		this.cache = {};
		this.pageIndex = [];

		this.finishInit(initConfig);
	}

	fetch(...args) {
		const runtime = {
			offset: this.state.offset,
			pageSize: this.state.pageSize,
			preset: {
				offset: this.state.offset,
				pageSize: this.state.pageSize
			}
		};

		return super._fetch(runtime, ...args);
	}

	setData(data) {
		if (isObject(data) && !this.isPartitioned) {
			const state = {};

			inject(state, data, {
				schema: {
					total: "number",
					pageSize: "number"
				},
				strictSchema: true
			});

			this.insert(data.data);
			this.setState(state);
		} else
			this.insert(data);
	}

	insert(data) {
		const used = {};
		let fetchedLength = 0;

		const insert = path => {
			if (typeof path != "string")
				throw new Error("Cannot insert: invalid partition path");
			if (used.hasOwnProperty(path))
				throw new Error(`Already inserted partition with path '${path}'`);

			const insertionData = get(data, path);

			if (!Array.isArray(insertionData))
				return [];

			let insertion = [];
			for (let i = 0, l = insertionData.length; i < l; i++) {
				const item = insertionData[i],
					seq = this.process("sequence")(item),
					tag = this.process("tag")(item),
					key = this.process("key")(item);
	
				if (this.meta.useSequencing && (!isFiniteNum(seq) || seq % 1 != 0))
					throw new TypeError("Found non-integer sequence number");
	
				insertion.push({
					seq,
					tag,
					key,
					data: item,
					idx: i
				});
			}

			if (this.meta.useSequencing && insertionData.length) {
				insertion = mergesort(insertion, (a, b) => {
					return b.seq - a.seq;
				});
	
				const maxSeq = insertion[0].seq;
				let rMaxSeq = this.meta.maxSequence;

				this.cache[path] = this.cache[path] || [];
	
				if (rMaxSeq === null)
					rMaxSeq = this.meta.maxSequence = maxSeq;
				else if (maxSeq > rMaxSeq) {
					this.shiftCache(path, maxSeq - rMaxSeq);
					rMaxSeq = this.meta.maxSequence = maxSeq;
				}
	
				for (let i = 0, l = insertion.length; i < l; i++) {
					const item = insertion[i],
						idx = rMaxSeq - item.seq;
	
					this.cache[path][idx] = item;
				}
			}

			fetchedLength += insertion.length;
			return insertion;
		};

		if (this.isPartitioned) {
			const partitions = this.config.partitions,
				outData = getPaginationDataStruct(this);

			for (let i = 0, l = partitions.length; i < l; i++) {
				const path = partitions[i],
					ctx = get(outData, path, null, "context");

				ctx.context[ctx.key] = insert(path);
			}

			super.setData(outData);
		} else
			super.setData(insert(""));

		this.setState({
			fetchedLength
		});

		return true;
	}

	setPage(page) {
		if (typeof page != "number")
			return;

		page = Math.max(page, 0);

		this.setState({
			page
		});
	}

	setPageSize(pageSize) {
		if (typeof pageSize != "number")
			return;

		pageSize = Math.max(pageSize, 5);

		this.setState({
			pageSize
		});
	}

	shiftCache(partitionName, amount = 0) {
		const partition = this.cache[partitionName];

		for (let i = partition.length - 1; i >= 0; i--) {
			if (partition.hasOwnProperty(i))
				partition[i + amount] = partition[i];
			
			if (i < amount)
				delete partition[i];
		}
	}

	getKey(item) {
		if (item && item.key != null)
			return item.key;

		const key = super.getKey(item);

		if (key != null)
			return key;

		if (!item)
			return null;

		return `@idx: ${item.idx} / @offset: ${this.state.offset} / @fetches: ${this.state.fetches}`;
	}

	getData(item) {
		return item.data;
	}
}

function getPaginationDataStruct(pagination) {
	const partitions = pagination.config.partitions,
		partitionedOut = {},
		used = {};

	if (!partitions || !Array.isArray(partitions))
		return [];

	for (let i = 0, l = partitions.length; i < l; i++) {
		const path = partitions[i];

		if (path == "") {
			if (partitions.length > 1)
				throw new Error("Cannot create data structure: only one root path allowed if present");

			return [];
		}

		if (typeof path != "string")
			throw new Error("Cannot create data structure: invalid partition path");
		if (used.hasOwnProperty(path))
			throw new Error(`Cannot create data structure: partition with path '${path}' already exists`);
		used[path] = true;

		const ctx = get(partitionedOut, path, null, "context|autoBuild");
		ctx.context[ctx.key] = [];
	}

	return partitionedOut;
}
