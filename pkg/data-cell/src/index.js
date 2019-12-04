import DataCell from "./data-cell";
import DataCellComposite from "./data-cell-composite";
import DataCellPagination from "./data-cell-pagination";

DataCell.constructors = {
	normal: DataCell,
	default: DataCell,
	composite: DataCellComposite,
	pagination: DataCellPagination
};

function mkDataCell(config, initConfig) {
	if (config) {
		let constr;

		if (typeof config.type == "string")
			constr = DataCell.constructors[config.type] || DataCell.constructors.default;
		else
			constr = DataCell.constructors.default;

		return new constr(config, initConfig);
	}

	throw new Error(`Cannot make data cell: invalid configuration object`);
}

DataCell.new = mkDataCell;

export default DataCell;
export {
	mkDataCell
};
