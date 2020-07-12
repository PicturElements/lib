import {
	apply,
	get,
	isObj,
	clone,
	hasOwn,
	unenum,
	equals,
	inject,
	isObject,
	combine,
	coerceNum,
	isFiniteNum
} from "@qtxr/utils";
import EVT from "@qtxr/evt";
import {
	Queue,
	Animation
} from "@qtxr/anim";
import I18NManager from "@qtxr/i18n";

// Utilities
import CalcCache from "../utilities/calc-cache";
import CalcInjector from "../utilities/calc-injector";
import CTX2D from "../utilities/ctx2d";
import Undoable, {
	UndoableQueue,
	UndoableDict
} from "../utilities/undoable";
import { applyInstantiators } from "../utilities/instantiator";
import renderTextTemplate from "../utilities/render-text-template";
import parseTemplate from "../utilities/parse-template";

import VizMessenger from "./viz-messenger";
import Dataset from "./dataset";

// Modules
import InfoBox from "./modules/info-box";

import {
	createContexts,
	copyContexts,
	clearCanvasDS,
	registerEvent,
	drawYAxis,
	addScrollEvt,
	getUnsuffixedViewportData,
	autoViewport,
	getTargetViewport,
	setViewport
} from "./viz-utils";

import {
	node,
	fillInData,
	getClosestIndex,
	mapClone,
} from "../utils";

import mkGetterManager from "../getters/mk-getter-manager";

// TODO:
// - defaultGraphData should be easier to get default data from.
// 		As it stands, you have to define an object with a "standard" key
// - Add setting that sets "tracking", i.e. how the graph should repaint if there's new data
// 		For example: lock to last value, slide to fit span
// - make derived graph modules, possibly.
// - add support for cross-module tasks
// - add in absolutely positioned graphs that inherit the collector value of the parent

// Idea: create a style editor

// TODO: registerWidget and similar functions
// ctx style settings module

let vizCount = 0;

// ------ OBLIGATORY ------
// wrapper		- the DOM node into which the graph, widgets, etc. are to be rendered.
// ------ OPTIONALS ------
// graphData	- data for rendering and managing graphs. It's an object containing graph types.
// config		- configuration data. This is used as RO global data. Script should at no point modify this, nor should changes ever
//				  affect the DOM directly. For this reason, updating the config will only update the graph but not re-render the DOM.
// globals		- data that edits the Viz instance at the top level
// displayId	- graph display ID. Specifies which graphdata to use. Graph will only render if this is a valid ID.
// DEPRECATED: localeKey	- the key to the desired locale. Invalid or falsy key will set the default locale.
export default class Viz {
	constructor(wrapper, optionals = {}) {
		this.wrapper = wrapper;
		this.state = {
			graphId: null,
			styleMode: "normal",
			plotIndex: {},
			stats: {
				paints: 0,
				requestedUpdates: 0,
				updates: 0,
				updateAvgTime: 0,
				refreshes: 0,
				collects: 0,
				renders: 0,
				domUpdates: 0,
				dataUpdates: 0,
				partialDomUpdates: 0
			},
			paintCycle: {
				count: -1,
				open: false
			}
		};

		if (isObject(optionals.i18n))
			this.i18n = new I18NManager(optionals.i18n);
		else
			this.i18n = optionals.i18n || new I18NManager();

		this.i18n.hook("localeset", _ => this.update());
		this.i18n.hook("localeloaded", _ => this.update());

		this.cache = optionals.cache || new CalcCache();
		this.cache.registerCachePartition("paint");
		this.cache.registerCachePartition("queryDatasets");

		this.injector = optionals.injector || new CalcInjector();
		this.injector.registerInjectorPartition("insertDataset");

		this.messenger = optionals.messenger || new VizMessenger();

		const dynamicArgs = {
			owner: this
		};

		if (isObject(optionals.getter)) {
			this.getter = mkGetterManager();
			this.getter.addGetters(optionals.getter);
		} else
			this.getter = optionals.getter || mkGetterManager();

		this.config = fillInDataApplyInstantiators(
			optionals.config || {},
			this.getter.get("defaults.config"),
			false,
			dynamicArgs
		);

		this.assets = fillInDataApplyInstantiators(
			optionals.assets || {},
			this.getter.get("defaults.assets"),
			false,
			dynamicArgs
		);

		this.graphData = fillInDataApplyInstantiators(
			optionals.graphData || {},
			this.getter.get("defaults.graphData"),
			false,
			dynamicArgs
		);

		this.currentGraphData = null;
		this.elements = {};
		this.dataRefs = {
			list: [],
			dict: Object.create(null)
		};
		this.globalData = {
			events: new UndoableQueue()
		};

		// If the config data includes a night mode style, complement it
		// with day mode data where needed, and create a day mode clone.
		if (hasOwn(this.config, "styleAlt"))
			this.registerAltStyle(this.config.styleAlt);

		this.setGraphId(optionals.displayId || Object.keys(this.graphData)[0]);

		this.id = vizCount++;
	}

	setGraphId(id) {
		if (this.state.graphId == id || !hasOwn(this.graphData, id))
			return;

		this.state.graphId = id;
		this.currentGraphData = this.graphData[id];

		this.refresh();
	}

	// Updates everything, including the DOM.
	refresh(immediateUpdate) {
		this.cleanse();
		this.construct();
		this.renderHTML();
		this.hardUpdate(immediateUpdate);
		this.messenger.post("refresh");
		this.state.stats.refreshes++;
	}

	// Clear stuff from the instance.
	cleanse() {
		this.removeDataRefs();

		const globals = this.globalData;

		// First clear event listeners
		globals.events.undoAll();

		this.messenger.post("cleanse");
	}

	// Refresh/add data to the instance. This method has the opposite action to the
	// cleanse method. It refreshes/adds data instead of destroying it.
	construct() {
		this.updateDataRefs();
		this.updateZIndex();

		const cgd = this.currentGraphData;
		// The local state (currentGraphData.state) is meant to contain information that's
		// unique to the current graph. The global state contains data that's shared among
		// graphs
		cgd.state = cgd.state || {
			width: 0,
			height: 0
		};

		// Parse template
		if (typeof cgd.template == "string") {
			const tmpl = this.getter.getSafe(["templates", cgd.template]) || cgd.template;
			cgd.template = parseTemplate(tmpl);
		}
	}

	openPaintCycle() {
		const pc = this.state.paintCycle;

		if (!pc.open) {
			pc.count++;
			pc.open = true;
		}
	}

	// Clear paint partition in cache. The cache should only be used before and while painting
	closePaintCycle() {
		this.cache.clearCache("paint");
		this.cache.clearCache("queryDatasets");
		this.state.paintCycle.open = false;
	}

	collect(index) {
		index = !!index;

		const cgd = this.currentGraphData,
			datasets = cgd.datasets;

		// Common data handling for both derived and basis data
		const handleCollectedDataset = (dataset, collection) => {
			// Update global data references
			this.updateDataRef(dataset);
			this.callHooks("handleCollectedDataset")(dataset, collection, index);
		};

		// First collect data for the basis datasets
		datasets.forEach(dataset => {
			if (!dataset.derived && get(dataset, "data.points")) {
				const dData = dataset.sourceData || dataset.data,
					collection = dataset.collect({
						data: dData,
						viewport: dataset.viewport,
						inst: this,
						index,
						dataset
					});

				handleCollectedDataset(dataset, collection);
			}
		});

		// Then collect data for the derived datasets.
		datasets.forEach(dataset => {
			if (dataset.derived) {
				const ref = dataset.refDataset;

				if (ref && get(ref, "data.points")) {
					const collection = dataset.collect({
						data: ref.data,
						viewport: dataset.viewport,
						inst: this,
						index,
						dataset
					});

					handleCollectedDataset(dataset, collection);
				}
			}
		});

		this.messenger.post("collect", datasets);
		this.state.stats.collects++;
	}

	throttledUpdate() {
		const perf = this.config.performance,
			rt = perf.throttleSampling;

		perf.unmonitoredCount = 0;

		if (!rt || rt == 1) {
			this.update();
			return;
		}

		const monitor = _ => {
			if (perf.unmonitoredCount == 3) {
				this.update(true);
				perf.unmonitoredCount = 0;
			} else {
				Queue.enqueue({}, monitor);
				perf.unmonitoredCount++;
			}
		};

		if (Math.floor(this.state.stats.requestedUpdates % rt) == 0)
			this.update();
		else {
			this.state.stats.requestedUpdates++;
			monitor();
		}
	}

	update(immediate) {
		const upd = _ => {
			const now = performance.now(),
				updates = this.state.stats.updates,
				weight = 0.7,
				invWeight = 1 - weight;

			this.callModuleCallbacks("preUpdate")();

			this.openPaintCycle();
			this.collect();
			this.paint();
			this.messenger.post("update");
			this.state.stats.updates++;
			this.state.stats.updateAvgTime = ((this.state.stats.updateAvgTime * updates) * invWeight + (performance.now() - now) * weight) / (updates * invWeight + weight);

			this.callModuleCallbacks("update", "postUpdate")();
		};

		if (this.config.performance.throttlingEnabled && immediate !== true)
			Queue.enqueue({}, upd);
		else
			upd();

		this.state.stats.requestedUpdates++;
	}

	hardUpdate(immediate) {
		this.updateDOM();
		this.update(immediate);
		this.messenger.post("hardUpdate");
	}

	paint() {
		const cgd = this.currentGraphData,
			datasets = cgd.datasets;

		this.openPaintCycle();

		this.callModuleCallbacks("prePaint")();

		if (cgd.zIndexMap) {
			const zim = cgd.zIndexMap;

			zim.forEach(({ idx }) => {
				const dataset = datasets[idx];

				if (get(dataset, "data.points")) {
					const args = {
						dataset,
						data: dataset.data,
						points: dataset.data.points,
						context: dataset.genPlotIndex ? dataset.ctxProxy.purgeIndex() : dataset.ctx,
						canvas: dataset.canvas,
						bounding: dataset.bounding,
						viewport: getTargetViewport(dataset),
						inst: this
					};

					// dataset.data includes bounding info, which is why we can use it
					// instead of the bounding data of the current graph data
					if (dataset.derived || dataset.localBounding)
						args.stateBounding = args.bounding;

					dataset.plot(args);
				}
			});
		}

		this.callModuleCallbacks("paint", "postPaint")();

		this.messenger.post("paint");
		this.state.stats.paints++;

		this.closePaintCycle();
	}

	// Renders the HTML that's then filled with the graphs, axes, etc.
	// matching the graph type at hand.
	renderHTML() {
		this.wrapper.innerHTML = "";

		const cgd = this.currentGraphData,
			template = cgd.template,
			modules = cgd.modules,
			ref = {};

		const filter = tmpl => {
			const criteria = tmpl.criteria,
				out = {
					tag: tmpl.tag,
					attributes: tmpl.attributes,
					id: tmpl.id,
					children: []
				};

			for (let i = 0, l = criteria.length; i < l; i++) {
				const crit = criteria[i],
					gotten = get(modules, crit.criterion);

				if (crit.matches === true) {
					if (!gotten)
						return null;
				} else {
					if (gotten !== crit.matches)
						return null;
				}
			}

			for (let i = 0, l = tmpl.children.length; i < l; i++) {
				const filtered = filter(tmpl.children[i]);

				if (filtered)
					out.children.push(filtered);
			}

			return out;
		};

		const render = (tmpl, parent) => {
			const attrs = inject({}, tmpl.attributes, {
				ignore: {
					class: true
				}
			});

			const n = node(tmpl.tag, tmpl.attributes.class, null, attrs);

			if (tmpl.id) {
				if (hasOwn(ref, tmpl.id))
					throw new Error(`Elements with duplicate ID found: '${tmpl.id}'`);

				if (hasOwn(modules, tmpl.id)) {
					modules[tmpl.id].dom = n;
					modules[tmpl.id].elems = {};
				}

				ref[tmpl.id] = n;
			}

			for (let i = 0, l = tmpl.children.length; i < l; i++)
				render(tmpl.children[i], n);

			n.app(parent);
		};

		this.callModuleCallbacks("preRender")();

		const filtered = filter(template);
		if (filtered)
			render(filtered, this.wrapper);

		this.elements = ref;

		// Let the modules that request a render on main render render...
		this.callModuleCallbacks("render", "postRender")();

		this.updateDOM();
		this.messenger.post("render");
		this.state.stats.renders++;
	}

	// Calculate and set little stuff to make the graph render properly
	// This should only do specific calculations with basic elements that
	// are common to use. Other calculations should be offloaded to their corresponding
	updateDOM() {
		this.callModuleCallbacks("preUpdateDOM")();
		this.callHooks("updateDOM")();
		this.callModuleCallbacks("updateDOM", "postUpdateDOM")();

		this.messenger.post("updateDOM");
		this.state.stats.domUpdates++;
	}

	// Basic messaging between modules: specify a source object, target module
	// names, followed by an array/string of its properties to call
	message(source, targets, message) {
		const modules = this.currentGraphData.modules;

		if (message && !message.source)
			message.source = source;

		for (let k in targets) {
			if (hasOwn(modules, k)) {
				const mod = modules[k],
					props = Array.isArray(targets[k]) ? targets[k] : [targets[k]];

				props.forEach(prop => {
					if (hasOwn(mod, prop) && typeof mod[prop] == "function")
						mod[prop](this, mod, message);
				});
			}
		}
	}

	insertDataset(dataset) {
		const datasets = this.currentGraphData.datasets,
			dsDict = this.dataRefs.dict;
		let i = 0;

		for (let l = datasets.length; i < l; i++) {
			const ds = datasets[i];
			if (ds.id == dataset.id) {
				datasets[i] = injectDatasetDependencies(conformDataset(dataset, this), this);
				break;
			}
		}

		if (i == datasets.length)
			datasets.push(injectDatasetDependencies(conformDataset(dataset), this));

		// Handle derived dataset
		if (dataset.reference) {
			this.injector
				.at("insertDataset")
				.pass(dataset)
				.for(dataset.reference)
				.when(_ => dataset.reference in dsDict)
				.inject(ds => {
					const ref = dsDict[ds.reference];
					ds.refDataset = ref;
					ref.derivedSets[ds.id] = ds;
				});

			if (!hasOwn(dataset, "derived"))
				unenum(dataset, "derived", true);
		}

		this.updateDataRef(datasets[i]);
		this.messenger.post("insertDataset", datasets);
		this.updateZIndex();
	}

	removeDataset(ds) {
		const datasets = this.currentGraphData.datasets,
			dataset = this.removeDataRef(ds);

		const handleRemove = index => {
			datasets.splice(index, 1);
			this.updateZIndex();

			if (dataset.derived)
				delete dataset.refDataset.derivedSets[dataset.id];

			this.messenger.post("removeDataset", dataset);
			return dataset;
		};

		if (dataset) {
			dataset.remove();

			for (let i = 0, l = datasets.length; i < l; i++) {
				const ds2 = datasets[i];
				if (ds2.id == dataset.id)
					return handleRemove(i);
			}
		}
	}

	editDataset(dataset, data) {
		if (dataset in this.dataRefs.dict) {
			inject(this.dataRefs.dict[dataset], data);
			this.updateZIndex();
		}
	}

	queryDatasets(query, invert) {
		invert = invert === true;

		if (!query || typeof query != "object")
			return invert ? this.currentGraphData.datasets : [];

		return this.currentGraphData.datasets.filter(ds => {
			for (let k in query) {
				if (hasOwn(query, k) && (!equals(query[k], ds[k])) ^ invert)
					return false;
			}

			return true;
		});
	}

	queryDatasetsMemoized(memoKey, query, invert) {
		return this.cache.request("queryDatasets", memoKey, _ => this.queryDatasets(query, invert), payload => payload, true);
	}

	applyDatasetModifier(query, modifier, invertQuery) {
		if (typeof query == "string")
			query = { id: query };

		modifier = typeof modifier == "function" ? modifier : ds => {
			const modifierStore = this.getter.get("modifiers.datasets"),
				mod = modifierStore[ds.type];

			if (typeof mod == "function")
				mod.call(modifierStore, ds, this);
		};

		const datasets = query instanceof Dataset ? [query] : this.queryDatasets(query, invertQuery);
		datasets.forEach(modifier);
	}

	applyDatasetModifierAll(exclude, modifier) {
		this.applyDatasetModifier(exclude, modifier);
	}

	setData(data, noUpdate, immediate) {
		const cgd = this.currentGraphData,
			datasets = cgd.datasets;

		if (!data)
			return;

		datasets.forEach(ds => {
			if (hasOwn(data, ds.id)) {
				const points = data[ds.id];

				ds.data = {
					points,
					startIdx: 0,
					endIdx: points.length - 1
				};
			}
		});

		this.collect(true);
		this.updateZIndex();

		if (!noUpdate)
			this.hardUpdate(immediate);
		this.messenger.post("setData", data);
		this.state.stats.dataUpdates++;
	}

	updateZIndex() {
		const datasets = this.currentGraphData.datasets,
			map = [];

		datasets.forEach((ds, i) => {
			const zIndex = ds.zIndex || 0;
			let ptr = 0;

			if (ds.visible !== false) {
				for (let l = map.length; ptr < l; ptr++) {
					if (map[ptr].z > zIndex)
						break;
				}

				map.splice(ptr, 0, {
					z: zIndex,
					idx: i
				});
			}
		});

		this.currentGraphData.zIndexMap = map;
	}

	setSize(w, h) {
		if (!w)
			this.config.dynamicSizeW = true;
		else {
			this.state.width = w;
			this.config.dynamicSizeW = false;
		}

		if (!h)
			this.config.dynamicSizeH = true;
		else {
			this.state.height = h;
			this.config.dynamicSizeH = false;
		}

		this.updateDOM();
		this.messenger.post("setSize");
	}

	setConfig(path, extend, immediateUpdate) {
		let config = this.config;

		if (!extend || typeof path != "string") {
			extend = path;
			path = null;
		}

		if (path) {
			config = get(this.config, path, null, {
				autoBuild: true
			});
		}

		Object.assign({}, config, extend);
		this.update(immediateUpdate);
		this.messenger.post("setConfig");
	}

	// setViewport, autoViewportX, autoViewportY, setViewportX, ans setViewportY assume the graph is built on a data range,
	// so the viewport of the graph is relevant to the plotting process. It should not affect any graphs that don't incorporate
	// a data range.
	setViewport(dataset, xArgs, yArgs, config = {}) {
		// These take care of the target flipping. Will not set if the argument
		// is targetting another argument.
		const xa = (yArgs && yArgs.target == "x") ? yArgs : (xArgs && xArgs.target != "y" ? xArgs : null),
			ya = (xArgs && xArgs.target == "y") ? xArgs : (yArgs && yArgs.target != "x" ? yArgs : null);

		const renderViewport = (vpFunc, args) => {
			vpFunc = vpFunc.bind(this);
			const dur = args.duration,
				sMin = args.startMin,
				sMax = args.startMax,
				eMin = args.endMin,
				eMax = args.endMax,	// I use vim btw
				allNumerical = isFiniteNum(sMin + sMax + eMin + eMax);	// True iff all parameters are finite not-NaN numbers

			config.acceptNull = args.resettable;

			if (allNumerical && isFiniteNum(dur) && dur > 0) {
				return new Animation({
					handler: at => {
						vpFunc(dataset, interpolate(sMin, eMin, at), interpolate(sMax, eMax, at), config);
						this.update();
					},
					duration: dur,
					easing: this.assets.easings[args.timing] || this.assets.easings.easeInOut
				}).run();
			} else {
				vpFunc(dataset, eMin, eMax, config);
				this.update();
			}
		};

		if (xa && typeof xa == "object")
			return renderViewport(this.setViewportX, xa);
		if (ya && typeof ya == "object")
			return renderViewport(this.setViewportY, ya);
	}

	// From the current viewport, animate x axis to the full viewport
	autoViewportX(dataset, args) {
		const baseArgs = getUnsuffixedViewportData(this, dataset, "x");
		return autoViewport(this, dataset, baseArgs, args);
	}

	autoViewportY(dataset, args) {
		const baseArgs = getUnsuffixedViewportData(this, dataset, "y");
		return autoViewport(this, dataset, baseArgs, args);
	}

	setViewportX(dataset, start, end, config) {
		setViewport(this, dataset, start, end, "startX", "endX", config);
	}

	resetViewportX(dataset) {
		setViewport(this, dataset, null, null, "startX", "endX", { acceptNull: true });
	}

	setViewportY(dataset, start, end, config) {
		setViewport(this, start, end, "startY", "endY", config);
	}

	resetViewportY(dataset) {
		setViewport(this, dataset, null, null, "startY", "endY", { acceptNull: true });
	}

	updatePlotIndex(context) {
		if (!(context instanceof CTX2D))
			return;

		const dataset = context.owner;

		if (dataset.genPlotIndex)
			this.state.plotIndex[dataset.id] = context.index;
	}

	updateDataRefs() {
		const datasets = this.currentGraphData.datasets;
		datasets.forEach(dataset => this.updateDataRef(dataset));
	}

	updateDataRef(dataset) {
		this.dataRefs.dict[dataset.id] = dataset;

		const list = this.dataRefs.list;
		for (let i = 0, l = list.length; i < l; i++) {
			if (list[i] == dataset || list[i].id == dataset.id) {
				list[i] = dataset;
				return;
			}
		}

		list.push(dataset);
	}

	removeDataRefs() {
		this.dataRefs = {
			list: [],
			dict: Object.create(null)
		};
	}

	removeDataRef(ds) {
		const id = typeof ds == "object" ? ds.id : ds,
			dataset = this.dataRefs.dict[id];

		if (!dataset)
			return null;

		delete this.dataRefs.dict[id];

		const list = this.dataRefs.list;
		for (let i = 0, l = list.length; i < l; i++) {
			if (list[i] == dataset || list[i].id == dataset.id) {
				list.splice(i, 1);
				return dataset;
			}
		}
	}

	registerAltStyle(style) {
		if (!this.config.styleNorm)
			this.config.styleNorm = clone(this.config.style);

		this.config.styleAlt = fillInDataApplyInstantiators(this.config.styleAlt, this.config.styleNorm, false, {
			owner: this
		});
	}

	setStyleMode(type) {
		const conf = this.config,
			styles = {
				normal: conf.styleNorm || conf.style,
				alt: conf.styleAlt
			};

		if (!hasOwn(styles, type) || type == this.state.styleMode)
			return;

		if (type == "alt" && !styles.alt)
			throw new Error("There exists no alt style.");

		this.state.styleMode = type;
		conf.style = styles[type];
		this.paint();
	}

	addPlot(dataset, defKey) {
		dataset = dataset || {};

		const plotId = getDatasetId(this, defKey || "plot"),
			plotModes = {
				own: {
					type: null,
					id: plotId,				// It's recommended to keep this value generated to avoid collissions
					hasOwnCanvas: true
				},
				overlay: {
					type: null,
					id: plotId,
					hasOwnCanvas: false
				}
			};

		if (!hasOwn(dataset, "mode") || !hasOwn(plotModes, dataset.mode))
			throw new Error("Plot mode not defined. Datasets must have a valid mode property: " + Object.keys(plotModes).join(", "));

		// This allows data to be incomplete when this function is first called.
		if (!dataset.added) {
			// Insert default dataset data
			const graphMod = this.currentGraphData.modules.graph;
			mapClone(dataset, graphMod.defaults, dataset.defaultClone || graphMod.defaultClone);

			if (!dataset.type || typeof dataset.type != "string")
				throw new Error("Failed to add plot: dataset doesn't have a valid type");

			// Should only have to be a shallow copy/extension of the input data
			// Change this if anything deeper is required.
			dataset = conformDataset(Object.assign(plotModes[dataset.mode], dataset), this);
			unenum(dataset, "added", true);

			this.setPlotType(dataset, dataset.type, dataset.collect, dataset.plot);
			this.insertDataset(dataset);
		}

		mountPlot(this, dataset);

		// Update the graph layout. Call via Queue.enqueue (requestAnimationFrame)
		// to make sure the added plots are painted, AND, most importantly, that
		// the paint happens once and only once after an arbitrary amount of plots
		// have been added
		Queue.enqueue({}, _ => this.hardUpdate(true));

		this.messenger.post("addPlot", dataset);

		return dataset;
	}

	addDerivedPlot(data) {
		if (!data || !data.reference)
			return console.error("Failed to add derived plot: data doesn't contain a reference.");

		const dataset = this.addPlot(data, "derived");

		this.messenger.post("addDerivedPlot", dataset);
		return dataset;
	}

	removePlot(id, immediateUpdate) {
		const dataset = this.removeDataset(id);
		unmountPlot(this, dataset);
		this.update(immediateUpdate);
		this.messenger.post("removePlot", dataset);
	}

	remountPlots() {
		this.currentGraphData.datasets.forEach(dataset => {
			unmountPlot(this, dataset);
			mountPlot(this, dataset);
		});

		this.messenger.post("remountPlots");
	}

	setPlotType(dataset, type, collector, plotter, immediateUpdate) {
		collector = collector || type;
		plotter = plotter || type;

		if (!isObj(dataset))
			dataset = this.dataRefs.dict[dataset];

		if (typeof collector != "function") {
			if (isObject(collector))
				collector = this.getter.get(["processors", "collectors", collector.type], collector);
			else
				collector = this.getter.get(["processors", "collectors", collector]);
		}

		if (typeof plotter != "function") {
			if (isObject(plotter))
				plotter = this.getter.get(["processors", "plotters", plotter.type], plotter);
			else
				plotter = this.getter.get(["processors", "plotters", plotter]);
		}

		if (!dataset)
			err("dataset", dataset);
		if (!collector)
			err("collector", collector);
		if (!plotter)
			err("plotter", plotter);

		function err(type, val) {
			throw new Error(`Cannot set plot type: ${type} is not valid`);
		}

		dataset.type = type;
		dataset.collect = collector;
		dataset.plot = plotter;
		this.update(immediateUpdate);
	}

	// Crosshair drawing method. It takes the following arguments:
	// wrapper		- The element that defines the area where the crosshair is measuring.
	// dataset 		- Object with values that access the data that is required to measure.
	// => accessor	  This function needs a reference to the bounding area of the wrapper
	//				  to calculate values from the coordinate plane to the plotted plane.
	//				  It also expects width/height accessors, but these can be omitted
	//				  at the cost of reading from the DOM, potentially causing needless renders.
	// labellers	- Labellers that provide the labels at the end of each crosshair line. These are
	//				  pairs of functions that convert
	addCrosshair(wrapper, dataset, labellers, callback) {
		const overlay = this.currentGraphData.modules.overlay;

		if (!overlay)
			return console.error("Operation failed: Module has been assigned a crosshair, but does not have an overlay element.");

		const overlayDOM = overlay.dom;
		const move = (evt, payload) => {
			if (!payload)
				return;

			const {
				x,
				y,
				w,
				h,
				closestX,
				closestY,
				boundingX,
				boundingY,
				snappedX,
				snappedY,
				pointAbs
			} = payload;

			overlay.elems.vInner.innerHTML = labellers.vertical(this, closestX, boundingX, (x / w), snappedX);
			overlay.elems.hInner.innerHTML = labellers.horizontal(this, closestY, boundingY, (1 - y / h), snappedY);

			if (typeof callback == "function") {
				callback({
					x: closestX,
					y: closestY
				});
			}

			overlay.elems.vLine.style.left = x + "px";
			overlay.elems.hLine.style.top = pointAbs.y + "px";
		};

		this.addOverlayEvent("crosshair", dataset, wrapper, {
			move,
			focus(evt) {
				overlayDOM.classList.add("show-guidelines");
				this.move(evt);
			},
			blur() {
				overlayDOM.classList.remove("show-guidelines");
				if (callback)
					callback(null);
			}
		});

		wrapper.classList.add("crosshair");
	}

	addTooltip(wrapper, dataset, tooltipData) {
		const overlay = this.currentGraphData.modules.overlay,
			tooltipMod = this.currentGraphData.modules.tooltip;

		if (!overlay)
			console.error("Operation failed: Module has been assigned a tooltip, but does not have an overlay element.");

		const overlayDOM = this.elements.topOverlay;

		const move = (evt, payload) => {
			if (!payload)
				return;

			renderTooltip(evt, payload);
		};

		const renderTooltip = (evt, payload) => {
			if (wrapper != tooltipMod.currentWrapper) {
				tooltipMod.currentWrapper = wrapper;
				tooltipMod.maxIndex = 0;
			}

			const tips = tooltipData.tips || tooltipData,
				index = tooltipData.index || 0,
				tooltipFeedback = {
					render: true
				};

			if (index < tooltipMod.maxIndex)
				return;

			let sourceData = null;

			if (typeof tooltipData.getTooltipData == "function") {
				tooltipFeedback.cancelRender = _ => tooltipFeedback.render = false;
				sourceData = tooltipData.getTooltipData(evt, payload, tooltipFeedback, this);
			} else
				sourceData = payload.closestX.indexItem.data;

			overlayDOM.classList.toggle("show-tooltip", tooltipFeedback.render);

			if (!tooltipFeedback.render)
				return;

			tooltipMod.maxIndex = index;

			const {
				tooltip,
				tooltipGlobal,
				tooltipLocal
			} = overlay.elems;

			tooltipGlobal.innerHTML = "";
			tooltipLocal.innerHTML = "";

			if (tooltipMod.global instanceof Array)
				renderTooltipItems(tooltipGlobal, tooltipMod.global, sourceData);

			renderTooltipItems(tooltipLocal, tips, sourceData);

			const bcr = tooltip.getBoundingClientRect(),
				tooltipSpace = 5,
				{ x, y } = payload.pointAbs,
				{ w, h } = payload,
				left = (x + bcr.width + tooltipSpace * 2) < w ? x + tooltipSpace : x - bcr.width - tooltipSpace,
				top = (y + bcr.height + tooltipSpace * 2) < h ? y + tooltipSpace : y - bcr.height - tooltipSpace;

			tooltip.style.left = `${left}px`;
			tooltip.style.top = `${top}px`;
		};

		const renderTooltipItems = (wrapper, tooltips, sourceData) => {
			tooltips.forEach(tip => {
				if (typeof tip == "string")
					tip = { template: tip };

				const tooltipLegend = node("div", "tooltip-legend"),
					symbol = tip.symbol ? node("span", "tooltip-item-symbol").app(tooltipLegend) : null,
					legendText = node("span", "tooltip-legend-text").app(tooltipLegend),
					secondaryData = {
						viz: this,
						dataset,
						custom: tip.custom
					};

				legendText.innerHTML = renderTextTemplate(tip.template, sourceData, secondaryData, "n/a");

				if (symbol) {
					const symbolData = tip.symbol || "square: transparent",
						symbolSplit = symbolData.trim().split(/\s*:\s*/),
						s1 = symbolSplit[1];

					symbol.classList.add("symbol-" + symbolSplit[0]);
					const col = get(sourceData, s1, get(this.config.style, s1, s1));
					symbol.style.background = col;
				}

				tooltipLegend.app(wrapper);
			});
		};

		this.addOverlayEvent("tooltip", dataset, wrapper, {
			move,
			focus(evt) {
				overlayDOM.classList.add("show-tooltip");
				tooltipMod.maxIndex = 0;
				this.move(evt);
			},
			blur() {
				overlayDOM.classList.remove("show-tooltip");
				tooltipMod.maxIndex = 0;
			}
		});

		wrapper.classList.add("tooltip");
	}

	// Currently only fully supports vertical scale
	addScaleBox(wrapper, dataset) {
		if (!dataset.scale)
			return;

		let scaleData = {
			startW: dataset.width,
			startH: dataset.height,
			w: 0,
			h: 0,
			scaling: false,
			startCoords: null
		};

		const vWrapper = this.elements.wrapper,
			dom = {
				wrapper: node("div", "viz-scale-box-wrapper")
			};

		const startScale = (evt, data) => {
			scaleData.scaling = true;
			scaleData.startCoords = EVT.getCoords(evt, vWrapper);
			scaleData.startW = dataset.width;
			scaleData.startH = dataset.height;
			scale(evt);
		};

		const scale = evt => {
			if (!scaleData.scaling)
				return;

			const coords = EVT.getCoords(evt, vWrapper),
				w = scaleData.startW + (coords.x - scaleData.startCoords.x),
				h = scaleData.startH + (coords.y - scaleData.startCoords.y);

			dataset.setSize(null, h);

			scaleData.w = dataset.width;
			scaleData.h = dataset.height;
			this.hardUpdate();
		};

		const endScale = _ => {
			scaleData.scaling = false;
			scaleData.startW = scaleData.w;
			scaleData.startH = scaleData.h;
		};

		const add = (type, scalePos) => {
			const scaleBar = node("div", `viz-scale-bar scale-${type} ${scalePos}`);

			this.addEvents(type + "-scale", dataset, [
				{
					types: ["mousedown", "touchstart"],
					element: scaleBar,
					handler: startScale
				},
				{
					types: ["mousemove", "touchmove"],
					element: document.body,
					handler: scale
				},
				{
					types: ["mouseup", "touchend", "leave"],
					element: document.body,
					handler: endScale
				}
			]);

			scaleBar.app(dom.wrapper);
			dom[type + "Bar"] = scaleBar;
		};

		if (dataset.scale.width)
			add("width", "right");

		if (dataset.scale.height)
			add("height", "bottom");

		dom.wrapper.app(wrapper);

		dataset.undoable.dict.set("scaleBox", Undoable.new(_ => {
			wrapper.removeChild(dom.wrapper);
		}));
	}

	addOverlayEvent(type, dataset, elem, events, data) {
		const overlay = this.currentGraphData.modules.overlay,
			overlayDOM = overlay.dom,
			accessors = dataset.accessors;

		let hovering = false;

		const move = evt => {
			const point = EVT.getCoords(evt, elem),
				pointAbs = EVT.getCoords(evt, overlayDOM),
				bounding = get(this, accessors.bounding),
				w = get(this, accessors.width),
				h = get(this, accessors.height);

			let {
				x,
				y
			} = point;

			if (bounding) {
				let boundingX = {
						min: bounding.minX,
						max: bounding.maxX,
						span: bounding.spanX
					},
					boundingY = {
						min: bounding.minY,
						max: bounding.maxY,
						span: bounding.spanY
					},
					closestX = null,
					closestY = null,
					snappedX = false,
					snappedY = false;

				if (hasOwn(accessors, "snapX")) {
					const plotIndex = get(this, accessors.snapX) || [],
						cx = getClosestIndex(plotIndex, point.x, "x");

					closestX = {
						indexItem: plotIndex[cx],
						index: cx
					};

					snappedX = Math.abs(closestX.indexItem.x - point.x) < 5;
					x = snappedX ? closestX.indexItem.x : point.x;
				}

				if (hasOwn(accessors, "snapY")) {
					const plotIndex = get(this, accessors.snapY) || [],
						cy = getClosestIndex(plotIndex, point.y, "y");

					closestY = {
						indexItem: plotIndex[cy],
						index: cy
					};

					snappedY = Math.abs(closestY.indexItem.y - point.y) < 5;
					y = snappedY ? closestY.indexItem.y : point.y;
				}

				apply(events, events.move, evt, {
					x,
					y,
					w,
					h,
					closestX,
					closestY,
					boundingX,
					boundingY,
					snappedX,
					snappedY,
					point,
					pointAbs,
					data,
					dataset,
					viz: this
				});
			} else {
				apply(events, events.move, evt, {
					x,
					y,
					w,
					h,
					point,
					pointAbs,
					data,
					dataset,
					viz: this
				});
			}
		};

		const touchMove = registerEvent(this, document.body, "touchmove", evt => {
			const ha = hasAncestor(getHoverElem(evt), elem);

			if (ha != hovering) {
				if (ha)
					apply(events, events.focus, evt);
				else
					apply(events, events.blur, evt);
				hovering = ha;
			}

			if (hovering) {
				move(evt);
				evt.preventDefault();
			}
		}, { passive: false });

		dataset.undoable.dict.set(type, Undoable.wrap({
			move: Undoable.as("event").do(elem, "mousemove", move),
			enter: Undoable.as("event").do(elem, "mouseenter", evt => apply(events, events.focus, evt)),
			leave: Undoable.as("event").do(elem, "mouseleave", evt => apply(events, events.blur, evt)),
			touchmove: Undoable.new(_ => {
				this.globalData.events.undo(touchMove);
			})
		}));
	}

	addEvents(type, dataset, events) {
		const evtUndoables = [];
		events = Array.isArray(events) ? events : [events];

		events.forEach(ev => {
			const combinations = combine({
				type: ev.types || ev.type,
				handler: ev.handlers || ev.handler,
				element: ev.elements || ev.element
			});

			combinations.forEach(c => {
				evtUndoables.push(Undoable.as("event").do(
					c.element,
					c.type,
					evt => apply(c.element, c.handler, evt, c)),
					ev.options
				);
			});
		});

		dataset.undoable.dict.set(type, Undoable.wrap(evtUndoables));
	}

	// Direct module method calling
	callModuleMethod(mod, methodName, ...args) {
		mod = typeof mod == "string" ? this.currentGraphData.modules[mod] : mod;

		if (mod && typeof mod[methodName] == "function")
			mod[methodName](this, mod, ...args);
	}

	callModuleCallbacks(...callbackNames) {
		const cgd = this.currentGraphData,
			mco = this.config.moduleCallOrder || {};

		return (...args) => {
			callbackNames.forEach(cName => {
				const callOrder = mco[cName] || mco.default,
					called = {};

				if (callOrder) {
					// First call all methods on modules that are specifically
					// requested to be handled in a specific order.
					callOrder.forEach(k => {
						const mod = cgd.modules[k];

						called[k] = true;

						if (mod && typeof mod[cName] == "function")
							mod[cName](this, mod, ...args);
					});
				}

				for (let k in cgd.modules) {
					const mod = cgd.modules[k];

					if (!hasOwn(called, k) && mod && typeof mod[cName] == "function")
						mod[cName](this, mod);
				}
			});
		};
	}

	callHooks(...hookNames) {
		const hooks = this.currentGraphData.hooks;

		if (hookNames.length < 2 && !hasOwn(hooks, hookNames[0]))
			return _ => _;

		return (...args) => {
			hookNames.forEach(hName => {
				if (hasOwn(hooks, hName))
					hooks[hName](this, ...args);
			});
		};
	}

	get loading() {
		return this.state.loading;
	}

	set loading(val) {
		if (typeof val == "boolean") {
			this.state.loading = val;
			const loader = this.elements.loader;

			if (loader)
				loader.classList.toggle("loading", val);
		}
		return this.state.loading;
	}
}

// Helper functions, etc.
function interpolate(start, end, pos) {
	return start + (end - start) * pos;
}

function getDatasetId(inst, desired) {
	const datasets = inst.currentGraphData.datasets,
		ids = {};

	datasets.forEach(d => ids[d.id] = true);

	while (true) {
		const key = desired + (i ? (i + 1) : "");
		if (!hasOwn(ids, key))
			return key;
	}
}

function getDatasetAccessor(dataset) {
	return "dataRefs.dict." + dataset.id;
}

function mountPlot(inst, dataset) {
	const refDataset = inst.dataRefs.dict[dataset.reference || dataset.targetPlot],
		baseAccessor = getDatasetAccessor(dataset);

	dataset.accessors = Object.assign({
		bounding: baseAccessor + ".bounding",
		width: baseAccessor + ".cWidth",
		height: baseAccessor + ".cHeight",
		dataset: baseAccessor
	}, dataset.accessors);

	switch (dataset.mode) {
		case "own": {
			const yAxis = inst.currentGraphData.modules.yAxis,
				graphBox = inst.elements.graphBox,
				box = node("div", "viz-graph-wrapper"),
				canv = (dataset.canvasType == "canvas" ? node("canvas", "viz-graph-canvas mode-canvas") : node("svg", "viz-graph-canvas mode-svg")).app(box),
				res = inst.config.canvRes;

			dataset.canvas = canv;

			if (dataset.canvasType == "canvas")
				createContexts(dataset, canv);
			else
				createContexts(dataset, null);

			if (yAxis) {
				const axCanv = node("canvas", "viz-vert-scale");
				box.insertBefore(axCanv, yAxis.orientation == "left" ? canv : null);

				dataset.yAxis = inject(dataset.yAxis, {
					canvas: axCanv,
					orientation: yAxis.orientation,
					draw: drawYAxis
				});

				dataset.yAxis.canvas = axCanv;

				createContexts(dataset.yAxis, axCanv);
			}

			dataset.cHeight = dataset.height;
			dataset.cHeightNatural = dataset.cHeight * res;

			distributeYIndex(inst, dataset);
			dataset.box = box;
			insertPlot(inst, dataset, graphBox);

			addInfoBox(box, dataset, true);

			if (dataset.crosshair) {
				const labels = Object.assign({}, dataset.labels);

				labels.vertical = inst.getter.getSafe(["processors", "labellers", labels.vertical]) || inst.getter.get("processors.labellers.linear");
				labels.horizontal = inst.getter.getSafe(["processors", "labellers", labels.horizontal]) || inst.getter.get("processors.labellers.linear");

				inst.addCrosshair(canv, dataset, labels, d => {
					inst.message(null, { legends: "paint" }, d);
				});
			}

			if (dataset.tooltip)
				inst.addTooltip(canv, dataset, dataset.tooltip);

			if (dataset.scroll)
				addScrollEvt(inst, dataset, canv);

			inst.addScaleBox(box, dataset);
			break;
		}

		case "overlay":
			if (refDataset.canvasType != dataset.canvasType)
				return console.error(`Failed to add overlay plot - incompatible canvas types: Reference dataset has type '${refDataset.canvasType}' but this dataset has type '${dataset.canvasType}'.`);

			if (dataset.tooltip)
				inst.addTooltip(refDataset.canvas.parentNode, dataset, dataset.tooltip);

			dataset.canvas = refDataset.canvas;
			dataset.ctx = refDataset.ctx;
			copyContexts(dataset, refDataset);
			addInfoBox(refDataset.infoBox.dom.wrapper, dataset);
			break;
	}
}

function addInfoBox(wrapper, dataset, primary) {
	if (!(dataset.infoBox instanceof InfoBox))
		dataset.infoBox = new InfoBox(dataset);

	dataset.infoBox.render(wrapper, primary);
}

function distributeYIndex(inst, dataset) {
	if (!dataset.yIndex && typeof dataset.yIndex != "number")
		dataset.yIndex = Infinity;

	let changeQueue = [],
		positiveDirection = dataset.yIndex >= 0,
		changeDir = positiveDirection ? 1 : -1,
		extremeIndex = null,
		performChange = false,
		yi = dataset.yIndex;

	// Get all datasets that are NOT overlaid sets
	const datasets = inst.queryDatasets({
		mode: "overlay"
	}, true);

	datasets.forEach(d => {
		const dyi = d.yIndex;

		if (Number.isFinite(dyi) && (extremeIndex === null || positiveDirection ^ dyi < extremeIndex))
			extremeIndex = dyi;

		if (d == dataset)
			return;

		if ((positiveDirection ^ dyi < yi) || dyi == yi)
			changeQueue.push(d);

		if (dyi == dataset.yIndex)
			performChange = true;
	});

	if (performChange)
		changeQueue.forEach(e => e.yIndex += changeDir);

	if (!isFinite(yi))
		dataset.yIndex = extremeIndex === null ? 0 : extremeIndex + changeDir;
}

function insertPlot(inst, dataset, parent) {
	const datasets = inst.queryDatasets({
		mode: "overlay"
	}, true);

	let minDiff = Infinity,
		closestElem = null;

	datasets.forEach(ds => {
		const diff = ds.yIndex - dataset.yIndex;

		if (diff > 0 && diff < minDiff && ds.box.parentNode == parent) {
			minDiff = diff;
			closestElem = ds.box;
		}
	});

	parent.insertBefore(dataset.box, closestElem);
}

function unmountPlot(inst, dataset) {
	if (!dataset)
		return;

	switch (dataset.mode) {
		case "own":
			dataset.box.parentNode.removeChild(dataset.box);
			removeNode(dataset.infoBox.wrapper);
			break;
		case "overlay":
			removeNode(dataset.infoBox.dom.infoCtrl);
	}
}

function conformDataset(ds, viz) {
	if (ds instanceof Dataset)
		return ds;
	return new Dataset(ds, viz);
}

function injectDatasetDependencies(ds, viz) {
	ds.undoable = {
		dict: new UndoableDict(),
		queue: new UndoableQueue()
	};

	ds.clearCanvas = clearCanvasDS;
	ds.store = ds.store || {};
	ds.derivedSets = ds.derivedSets || {};
	ds.bounding = {};
	ds.viewport = inject(ds.viewport, {
		startX: null,
		endX: null,
		startY: null,
		endY: null
	});

	ds.setSize = (w, h) => {
		w = coerceNum(w, ds.width);
		h = coerceNum(h, ds.height);

		w = Math.max(Math.min(w, coerceNum(ds.maxWidth, Infinity)), coerceNum(ds.minWidth, 0));
		h = Math.max(Math.min(h, coerceNum(ds.maxHeight, Infinity)), coerceNum(ds.minHeight, 0));

		ds.width = w;
		ds.height = h;

		const mainC = ds.canvas;

		ds.cWidth = w;
		ds.cWidthNatural = w * viz.config.canvRes;
		ds.cHeight = h;
		ds.cHeightNatural = h * viz.config.canvRes;

		mainC.style.width = w + "px";
		mainC.style.height = h + "px";

		if (ds.canvasType == "canvas") {
			mainC.width = ds.cWidthNatural;
			mainC.height = ds.cHeightNatural;
		} else
			mainC.setAttribute("viewBox", `0 0 ${ds.cWidthNatural} ${ds.cHeightNatural}`);
	};

	ds.remove = _ => {
		ds.undoable.dict.undoAll();
		ds.undoable.queue.undoAll();
	};

	return ds;
}

function removeNode(node) {
	const par = node ? node.parentNode : null;
	if (par)
		par.removeChild(node);
}

function hasAncestor(descendant, ancestor) {
	if (!ancestor || !descendant)
		return false;

	while (true) {
		if (descendant == ancestor)
			return true;
		if (!descendant || descendant == document.documentElement)
			return false;

		descendant = descendant.parentNode;
	}
}

function getHoverElem(evt) {
	const p = EVT.getCoords(evt);
	return document.elementFromPoint(p.x, p.y);
}

function fillInDataApplyInstantiators(target, reference, forceFill, dynamicArgs) {
	target = fillInData(target, reference, forceFill);
	return applyInstantiators(target, dynamicArgs);
}
