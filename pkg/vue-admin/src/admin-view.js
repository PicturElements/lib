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

		wrapper.add(this.component);
	}
}
