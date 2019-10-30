import DataCell from "./data-cell";
import DataCellPagination from "./data-cell-pagination";

export default function mkDataCell(config) {
	switch (config && config.type) {
		case "pagination":
			return new DataCellPagination(config);

		default:
			return new DataCell(config);
	}
}
