import {
	sym,
	earmark,
	serialize,
	matchQuery
} from "@qtxr/utils";

// All DataCell constructors
import DataCell, {
	injectPresets,
	isInjectedConfig
} from "./data-cell";
import DataCellComposite from "./data-cell-composite";
import DataCellPagination from "./data-cell-pagination";

const DATA_CELL_SPECIES_MAP = {
		normal: DataCell,
		composite: DataCellComposite,
		pagination: DataCellPagination
	},
	DATA_CELL_SPECIES_ALIASES = {
		normal: ["default"]
	},
	DATA_CELL_SPECIES_SYM = sym("DataCell species");

function definePreset(nameOrPreset, preset) {
	let name = nameOrPreset;

	if (typeof nameOrPreset != "string") {
		preset = nameOrPreset;
		name = "default";
	}

	if (!name || typeof name != "string")
		throw new Error(`Cannot define preset: invalid preset name ${serialize(name)}`);

	this.presets[name] = preset;
}

function mkDataCell(config, initConfig) {
	if (config) {
		if (!isInjectedConfig(config))
			config = injectPresets(config);

		const species = typeof config.species == "string" || (config.species && config.species[DATA_CELL_SPECIES_SYM]) ?
			config.species :
			config.type;
		let constr;

		if (species && species[DATA_CELL_SPECIES_SYM])
			constr = DataCell.constructors[species[DATA_CELL_SPECIES_SYM]];
		else if (typeof species == "string")
			constr = DataCell.constructors[species];
		else if (config[DATA_CELL_SPECIES_SYM])
			constr = DataCell.constructors[config[DATA_CELL_SPECIES_SYM]];
		
		constr = constr || DataCell.constructors.default;
		return new constr(config, initConfig);
	}

	throw new Error(`Cannot make data cell: invalid configuration object`);
}

function isCellConfig(candidate) {
	if (candidate && candidate[DATA_CELL_SPECIES_SYM])
		return true;

	if (candidate.type && candidate.type[DATA_CELL_SPECIES_SYM])
		return true;
	
	if (candidate.species && candidate.species[DATA_CELL_SPECIES_SYM])
		return true;

	return matchQuery(candidate, {
		isCell: "boolean",
		autoFetch: "boolean",
		type: "string",
		species: "string",
		method: "string",
		fetch: "function",
		handler: "function",
		processors: Object,
		preset: "string",
		presets: Array
	}, "typed|lazy");
}

DataCell.prototype.getSpecies = function() {
	return this.constructor[DATA_CELL_SPECIES_SYM];
};

DataCell.constructors = earmark(
	DATA_CELL_SPECIES_SYM,
	DATA_CELL_SPECIES_MAP,
	DATA_CELL_SPECIES_ALIASES
);

DataCell.presets = {};
DataCell.definePreset = definePreset;

DataCell.new = mkDataCell;

DataCell.isCellConfig = isCellConfig;

export default DataCell;
export {
	mkDataCell
};
