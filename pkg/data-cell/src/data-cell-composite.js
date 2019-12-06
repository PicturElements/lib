import DataCell from "./data-cell";
import {
	sym,
	get,
	forEach,
	isObject,
	mkAccessor,
	coerceToObj
} from "@qtxr/utils";

const HOOK_SYM = sym("composite data cell hook");

export default class DataCellComposite extends DataCell {
	constructor(config = {}) {
		super(config, {
			defaultState: {
				fullyLoaded: false,
				pendingChildrenCount: 0
			},
			preventDataSet: true,
			preventStateSet: true,
			preventAutoFetch: true
		});

		this.passive = false;
		this.parent = null;
		this.connectedToComposite = false;
		this.children = [];
		this.childrenStruct = null;

		const children = config.scope || config.cells;
		this.data = coerceToObj(null, children);
		this.addChildren(children);

		if (this.config.autoFetch)
			this.fetch();
	}

	hasChild(cellOrConfig) {
		return this.getChildIndex(cellOrConfig) > -1;
	}

	getChildIndex(cellOrConfig) {
		if (cellOrConfig instanceof DataCell) {
			for (let i = 0, l = this.children.length; i < l; i++) {
				if (this.children == cellOrConfig)
					return i;
			}
		}

		return -1;
	}

	addChildren(struct) {
		const add = (sct, path) => {
			forEach(sct, (s, k) => {
				const newPath = path.concat(k);

				if (DataCell.isCellConfig(s))
					this.addChild(newPath, s);
				else if (isObject(s))
					add(s, newPath);
			});
		};

		add(struct, []);
	}

	addChild(path, cellOrConfig) {
		if (Array.isArray(path))
			path = mkAccessor(path);

		if (typeof path != "string")
			throw new TypeError("Cannot add child: invalid path");

		if (this.hasChild(cellOrConfig))
			return this;

		const cell = resolveCell(cellOrConfig, this);

		cell.parent = this;
		this.children.push({
			path,
			cell
		});

		const gotten = get(this.data, path, null, "autoBuild|context");
		if (!gotten.match)
			gotten.context[gotten.key] = cell;

		return this;
	}

	removeChild(cell) {
		const idx = this.getChildIndex(cell);

		if (idx == -1)
			return this;

		cell.unhookNS(HOOK_SYM, "*");

		cell.parent = null;
		this.children.splice(idx, 1);

		return this;
	}

	setData(data) {
		const set = (inputData, cellData) => {
			forEach(inputData, (d, k) => {
				if (cellData[k] instanceof DataCell) {
					if (cellData[k].passive)
						cellData[k].setData(d);
				} else {
					cellData[k] = d;

					if (isObject(d))
						set(d, cellData[k]);
				}
			});
		};

		set(data, this.data);
	}

	propagateState(...states) {
		return propagateState(this, false, ...states);
	}

	propagateStatePassive(...states) {
		return propagateState(this, true, ...states);
	}

	async fetch(...args) {
		const fetches = [
			super.fetch(...args)
		];

		const fetchChildren = children => {
			for (let i = 0, l = children.length; i < l; i++) {
				const cell = children[i].cell;

				if (cell.state.loading)
					continue;

				if (!cell.passive) {
					fetches.push(
						cell.fetch(...args)
					);
				}

				if (Array.isArray(cell.children))
					fetchChildren(cell.children);
			}
		};

		fetchChildren(this.children);

		const responses = await Promise.all(fetches);
		const response = responses[0];

		if (!this.state.pendingChildrenCount) {
			this.setState({
				fullyLoaded: this.state.loaded
			});
		}

		if (response.success)
			this.propagateStatePassive("loaded");
		else
			this.propagateStatePassive("error");

		this.propagateStatePassive({
			fetches: this.state.fetches
		});

		return response;
	}
}

function resolveCell(cellOrConfig, parentCell) {
	let cell;
	
	if (cellOrConfig instanceof DataCell) {
		cell = cellOrConfig;

		if (typeof cell.passive != "boolean")
			cell.passive = false;

		cell.setState({
			fullyLoaded: false,
			pendingChildrenCount: 0
		});
	} else {
		const config = Object.assign({}, cellOrConfig),
			characteristics = parentCell.getFetcherCharacteristics(config);

		if (!characteristics.hasHandler) {
			config.fetch = async (cell, runtime, ...args) => {
				const parent = getActiveParent(cell);
				if (!parent)
					return null;

				return await parent.fetch(...args);
			};
		}

		cell = DataCell.new(config, {
			defaultState: {
				fullyLoaded: false,
				pendingChildrenCount: 0
			}
		});
		cell.passive = !characteristics.hasHandler;
	}

	cell.hook({
		partitionName: "*",
		namespace: HOOK_SYM,
		argTemplate: "context",
		handler: handleHooks
	});

	return cell;
}

function handleHooks(context) {
	const cell = context.hook.owner;

	switch (context.key) {
		case "loading":
			if (cell.passive)
				break;

			bubbleUp(cell, c => {
				if (c == cell)
					return;

				c.setState({
					fullyLoaded: false,
					pendingChildrenCount: c.state.pendingChildrenCount + 1
				});
			});
			break;

		case "fetched":
			if (cell.passive)
				break;

			bubbleUp(cell, c => {
				if (c == cell) {
					if (!c.state.pendingChildrenCount) {
						c.setState({
							fullyLoaded: true
						});
					}

					return;
				}

				const count = c.state.pendingChildrenCount - 1;

				c.setState({
					fullyLoaded: c.state.loaded && count == 0,
					pendingChildrenCount: count
				});
			});
			break;
	}
}

function propagateState(cell, passiveOnly, ...states) {
	const propagate = c => {
		if (!passiveOnly || c.passive)
			c.setState(...states);

		if (!Array.isArray(c.children))
			return;

		for (let i = 0, l = c.children.length; i < l; i++)
			propagate(cell.children[i].cell);
	};

	propagate(cell);
}

function bubbleUp(cell, callback) {
	while (cell) {
		callback(cell);
		cell = cell.parent;
	}
}

function getActiveParent(cell) {
	while (cell) {
		cell = cell.parent;

		if (cell && !cell.passive)
			return cell;
	}

	return null;
}
