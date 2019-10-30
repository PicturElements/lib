import DataCell from "./data-cell";
import {
	get,
	inject,
	isObject,
	mergesort,
	isFiniteNum,
	requestFrame
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

export default class DataCellPagination extends DataCell {
	constructor(config = {}) {
		super(config, {
			partitionClassifier: {
				pageSize: "garbage",
				page: "garbage",
				length: "garbage"
			},
			defaultState: {
				pageSize: config.pageSize || 25,
				page: config.page || 0,
				offset: (config.pageSize || 25) * (config.page || 0),
				total: config.total || Infinity
			},
			processorOptions: PROCESSSOR_OPTIONS,
			preventDataSet: true,
			preventStateSet: true,
			preventAutoFetch: true
		});

		this.meta = {
			useSequencing: this.processors.hasOwnProperty("sequence"),
			useTagging: this.processors.hasOwnProperty("tag"),
			maxSequence: null
		};

		this.data = [];
		this.cache = [];
		this.pageIndex = [];

		this.setData(this.config.data);
		this.setState(this.config.state);

		if (this.config.autoFetch)
			this.fetch();
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
		if (isObject(data)) {
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

	insert(arr) {
		if (!Array.isArray(arr) || !arr.length)
			return false;

		let insertion = [];
		for (let i = 0, l = arr.length; i < l; i++) {
			const item = arr[i],
				seq = this.process("sequence")(item),
				tag = this.process("tag")(item);

			if (this.meta.useSequencing && (!isFiniteNum(seq) || seq % 1 != 0))
				throw new TypeError("Found non-integer sequence number");

			insertion.push({
				seq,
				tag,
				data: item
			});
		}

		if (this.meta.useSequencing) {
			insertion = mergesort(insertion, (a, b) => {
				return b.seq - a.seq;
			});

			const maxSeq = insertion[0].seq;
			let rMaxSeq = this.meta.maxSequence;

			if (rMaxSeq === null)
				rMaxSeq = this.meta.maxSequence = maxSeq;
			else if (maxSeq > rMaxSeq) {
				this.shiftData(maxSeq - rMaxSeq);
				rMaxSeq = this.meta.maxSequence = maxSeq;
			}

			for (let i = 0, l = insertion.length; i < l; i++) {
				const item = insertion[i],
					idx = rMaxSeq - item.seq;

				this.cache[idx] = item;
			}
		}
		
		super.setData(insertion);

		return true;
	}

	setPage(page) {
		if (typeof page != "number")
			return;

		page = Math.max(page, 0);

		this.setState({
			page,
			offset: this.state.pageSize * page
		});
	}

	setPageSize(pageSize) {
		if (typeof pageSize != "number")
			return;

		pageSize = Math.max(pageSize, 5);

		const changes = this.setState({
			pageSize,
			offset: this.state.page * pageSize
		});

		if (changes.pageSize)
			this.fetch();
	}

	shiftCache(amount = 0) {
		for (let i = this.cache.length - 1; i >= 0; i--) {
			if (this.cache.hasOwnProperty(i))
				this.cache[i + amount] = this.cache[i];
			
			if (i < amount)
				delete this.cache[i];
		}
	}
}
