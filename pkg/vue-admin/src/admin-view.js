import {
	isObj,
	partition
} from "@qtxr/utils";
import { mkDataCell, injectPresets } from "@qtxr/data-cell";
import Form from "@qtxr/form";

const adminViewClassifier = {
	meta: "self"
};

export default class AdminView {
	constructor(owner, viewConfig) {
		viewConfig = Object.assign({}, viewConfig);

		this.owner = owner;
		this.component = {};

		partition(viewConfig, {
			self: this,
			default: this.component
		}, adminViewClassifier);
	}

	connect(wrapper) {
		wrapper.addData("view", this);

		const configs = this.component.dataCells || {},
			outCells = {};

		for (const k in configs) {
			if (!configs.hasOwnProperty(k))
				continue;

			const config = injectPresets(configs[k]);

			if (config.persistent) {
				const cell = mkDataCell(config);

				outCells[k] = (wrapper, vm) => {
					connectDataCells(cell, {
						vm,
						wrapper,
						outCells,
						key: k,
						persistent: true
					});

					return cell;
				};
			} else {
				outCells[k] = (wrapper, vm) => {
					const cell = mkDataCell(config);

					connectDataCells(cell, {
						vm,
						wrapper,
						outCells,
						key: k,
						persistent: false
					});

					return cell;
				};
			}
		}

		wrapper.use("computedData", outCells);
		wrapper.add(this.component);
	}
}

function connectDataCells(cell, args) {
	const cells = cell.getCells();

	for (let i = 0, l = cells.length; i < l; i++) {
		connectDataCell(Object.assign({
			config: cells[i].config,
			cell: cells[i]
		}, args));
	}
}

function connectDataCell(args) {		
	args.cell.baseRuntime.vm = args.vm;
	connectForm(args);
}

function connectForm({ vm, cell }) {
	let rows;

	if (typeof cell.config.formRows == "function") {
		rows = cell.config.formRows({
			vm,
			cell,
			Form
		});
	}

	if (isObj(rows)) {
		const form = new Form();
		cell.form = form;
		form.connectRows(rows);
		form.setValues(cell.state);
		form.hook("update", f => cell.setState(f.extract()));
	}
}
