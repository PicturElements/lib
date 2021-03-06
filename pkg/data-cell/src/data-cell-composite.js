import DataCell from "./data-cell";
import {
	sym,
	get,
	inject,
	forEach,
	isObject,
	concatMut,
	mkAccessor,
	coerceToObj
} from "@qtxr/utils";

const HOOK_SYM = sym("composite data cell hook");

export default class DataCellComposite extends DataCell {
	constructor(config = {}, initConfig = {}) {
		initConfig = inject({
			defaultState: {
				fullyLoaded: false,
				pendingChildrenCount: 0
			}
		}, initConfig, "override");

		super(config, initConfig);

		this.passive = false;
		this.parent = null;
		this.connectedToComposite = false;
		this.children = [];

		const children = config.scope || config.cells;
		this.data = coerceToObj(null, children);
		this.addChildren(children);

		this.finishInit(initConfig);
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

		const cell = resolveCell(cellOrConfig, this, path),
			gotten = get(this.data, path, null, "autoBuild|context");

		if (!gotten.match)
			gotten.context[gotten.key] = cell;

		if (this.path && typeof this.path == "string")
			path = `${this.path}.${path}`;

		cell.path = path;
		cell.parent = this;
		this.children.push(cell);

		cell.setState({
			fullyLoaded: false,
			pendingChildrenCount: 0
		});

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
						cellData[k].setData(cellData[k].process("data")(d));
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
		return propagateState(this, null, ...states);
	}

	propagateStatePassive(...states) {
		return propagateState(this, "passive", ...states);
	}

	propagateStateActive(...states) {
		return propagateState(this, "active", ...states);
	}

	propagateStatePassiveChild(...states) {
		return propagateState(this, "passive-child", ...states);
	}

	propagateStateActiveChild(...states) {
		return propagateState(this, "active-child", ...states);
	}

	propagateHooks(partitionName, ...args) {
		return propagateHooks(this, null, partitionName, ...args);
	}

	propagateHooksPassive(partitionName, ...args) {
		return propagateHooks(this, "passive", partitionName, ...args);
	}

	propagateHooksActive(partitionName, ...args) {
		return propagateHooks(this, "active", partitionName, ...args);
	}

	propagateHooksPassiveChild(partitionName, ...args) {
		return propagateHooks(this, "passive-child", partitionName, ...args);
	}

	propagateHooksActiveChild(partitionName, ...args) {
		return propagateHooks(this, "active-child", partitionName, ...args);
	}

	propagate(mode, callback) {
		propagate(this, mode, callback);
	}

	async fetch(...args) {
		const fetches = [
			super.fetch(...args)
		];

		const fetchChildren = children => {
			for (let i = 0, l = children.length; i < l; i++) {
				const cell = children[i];

				if (cell.state.loading)
					continue;

				if (cell.passive) {
					cell.setState("loading");
					cell.callHooks("loading");
					cell.args.runtime = this.args.runtime;
				} else {
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

		if (response.success) {
			this.propagateStatePassive("loaded");
			this.propagateHooksPassive("success", response);
		} else {
			this.propagateStatePassive("error", {
				errorMsg: response.errorMsg
			});
			this.propagateHooksPassive("fail", response);
		}

		propagateState(
			this,
			c => c.passive && c != response.runtime.initiator,
			{ fetches: this.state.fetches }
		);

		return response;
	}

	getCells() {
		const cells = [this];

		for (let i = 0, l = this.children.length; i < l; i++)
			concatMut(cells, this.children[i].getCells());

		return cells;
	}
}

function resolveCell(cellOrConfig, parentCell, path) {
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
		const config = Object.assign({
				path
			}, cellOrConfig),
			characteristics = parentCell.getFetcherCharacteristics(config);

		if (!characteristics.hasHandler) {
			config.fetch = async ({ cell }, ...args) => {
				const parent = getActiveParent(cell);
				if (!parent)
					return null;

				const parentResponse = await parent
					.with({ initiator: cell })
					.fetch(...args);

				return wrapParentResponse(cell, parentResponse, cell.path);
			};
		}

		const inheritedConfig = inject(
			config,
			parentCell.inheritableConfig.config
		);

		const inheritedInitConfig = inject(
			{
				defaultState: {
					fullyLoaded: false,
					pendingChildrenCount: 0
				},
				partitionClassifier: {
					path: "instance"
				}
			},
			parentCell.inheritableConfig.initConfig
		);

		cell = DataCell.new(inheritedConfig, inheritedInitConfig);
		cell.passive = !characteristics.hasHandler;
	}

	cell.hook({
		name: "*",
		namespace: HOOK_SYM,
		argTemplate: "context",
		handler: handleHooks
	});

	return cell;
}

function wrapParentResponse(cell, response, path) {
	if (response.success) {
		return cell.mkSuccessResponse(get(response.processedData, path), {
			sourceResponse: response
		});
	} else {
		return cell.mkErrorResponse(response.errorMsg, {
			sourceResponse: response
		});
	}
}

function handleHooks(context) {
	const cell = context.owner;

	switch (context.name) {
		case "loading":
			bubbleUp(cell, c => {
				if (c == cell) {
					c.setState({
						fullyLoaded: false
					});
					return;
				}

				c.setState({
					fullyLoaded: false,
					pendingChildrenCount: c.state.pendingChildrenCount + 1
				});
			});
			break;

		case "fetched":
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

function propagate(cell, mode, callback) {
	const prop = c => {
		if (!mode || (mode == "passive" && c.passive))
			callback(c, cell);
		else if (mode == "active" && !c.passive)
			callback(c, cell);
		else if (c != cell && mode == "passive-child" && c.passive) {
			callback(c, cell);
			return;
		} else if (c != cell && mode == "active-child" && !c.passive) {
			callback(c, cell);
			return;
		} else if (typeof mode == "function" && mode(c, cell))
			callback(c, cell);

		if (!Array.isArray(c.children))
			return;

		for (let i = 0, l = c.children.length; i < l; i++)
			prop(c.children[i]);
	};

	prop(cell);
}

function propagateState(cell, mode, ...states) {
	propagate(cell, mode, c => {
		c.setState(...states);
	});
}

function propagateHooks(cell, mode, partitionName, ...args) {
	propagate(cell, mode, c => {
		c.callHooks(partitionName, ...args);
	});
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
