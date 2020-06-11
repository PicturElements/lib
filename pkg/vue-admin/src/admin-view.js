import {
	isObj,
	hasOwn,
	partition
} from "@qtxr/utils";
import DataCell from "@qtxr/data-cell";
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

		const cellConfigs = this.component.dataCells || {},
			outCells = {};

		for (const k in cellConfigs) {
			if (!hasOwn(cellConfigs, k))
				continue;

			const config = DataCell.resolveConfig(cellConfigs[k]);

			if (config.persistent) {
				const cell = DataCell.new(config);

				outCells[k] = (wrapper, vm) => {
					connectDataCells(cell, {
						vm,
						wrapper,
						outCells,
						key: k,
						admin: this.owner,
						persistent: true
					});

					return cell;
				};
			} else {
				outCells[k] = (wrapper, vm) => {
					const cell = DataCell.new(config);

					connectDataCells(cell, {
						vm,
						wrapper,
						outCells,
						key: k,
						admin: this.owner,
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
	args.cell.extendBaseRuntime({
		vm: args.vm,
		admin: args.admin
	});

	args.cell.extendArguments({
		admin: args.admin
	});
}

DataCell.defineLoader({
	formRows: "function|Object|Array"
}, ({ cell, value: rows }) => {
	if (isObj(rows)) {
		const form = new Form();
		cell.extendArguments("form", form);
		cell.extendBaseRuntime("form", form);
		form.connectRows(rows);
		form.setValues(cell.state);
		form.hook("update", a => cell.setState(a.form.extract()));
	}
});
