import { partition } from "@qtxr/utils";
import { mkDataCell } from "@qtxr/data-cell";

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
					persistentCell.baseRuntime.vm = vm;
					return persistentCell;
				};
			} else {
				outCells[k] = (wrapper, vm) => {
					const nonPersistentCell = mkDataCell(cell);
					nonPersistentCell.baseRuntime.vm = vm;
					return nonPersistentCell;
				};
			}
		}

		wrapper.use("computedData", outCells);

		wrapper.add("data", this.component.data);
		wrapper.add("provide", this.component.provide);
		wrapper.add("methods", this.component.methods);
		wrapper.add("computed", this.component.computed);
		wrapper.add("props", this.component.props);
		wrapper.add("components", this.component.components);
	}
}
