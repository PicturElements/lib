import {
	isObj,
	partition
} from "@qtxr/utils";
import { mkDataCell } from "@qtxr/data-cell";
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

		const cells = this.component.dataCells || {},
			outCells = {};

		for (const k in cells) {
			if (!cells.hasOwnProperty(k))
				continue;

			const cell = cells[k];

			if (cell.persistent) {
				const persistentCell = mkDataCell(cell);

				outCells[k] = (wrapper, vm) => {
					connectDataCell({
						vm,
						wrapper,
						outCells,
						key: k,
						config: cell,
						cell: persistentCell,
						persistent: true
					});
					persistentCell.baseRuntime.vm = vm;
					return persistentCell;
				};
			} else {
				outCells[k] = (wrapper, vm) => {
					const nonPersistentCell = mkDataCell(cell);
					connectDataCell({
						vm,
						wrapper,
						outCells,
						key: k,
						config: cell,
						cell: nonPersistentCell,
						persistent: false
					});
					nonPersistentCell.baseRuntime.vm = vm;
					return nonPersistentCell;
				};
			}
		}

		wrapper.use("computedData", outCells);
		wrapper.add(this.component);
	}
}

function connectDataCell(args) {
	connectForm(args);
}

function connectForm({ vm, cell, config }) {
	let rows;

	if (typeof config.formRows == "function") {
		rows = config.formRows({
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
