

import {
	get,
	inject,
	isFiniteNum
} from "@qtxr/utils";

import { node } from "../../utils";
import renderTextTemplate from "../../utilities/render-text-template";

import {
	clearCanvas,
	createContexts,
	paintGridsAndAxes,
	drawXAxis,
	drawYAxis,
	addScrollEvt,
	addResizeEvt,
	getTargetBounding,
	getTargetViewport
} from "../../engine/viz-utils";

function getter(config, assets, r) {
	return {
		fillRecessive: true,
		standard: {
			modules: {
				fillRecessive: true,
				graph: {
					fillDominant: true,
					datasets: [],
					defaults: {
						canvasType: "canvas",
						height: 70,
						width: null,
						genPlotIndex: false,	// For performance reasons, this is disabled by default.
						boxLayout: false,
						useOwnViewport: false,
						useOwnBounding: true,
						propagateBounding: {
							minX: false,
							minY: false,
							maxX: false,
							maxY: false,
							propagateOwn: true
						},
						accessors: {
							xAxis: "assets.axes.time",
							yAxis: "assets.axes.linear"
						},
						padding: {
							t: 20,
							r: 5,
							b: 20,
							l: 5
						},
						legendConfig: {

						}
					},
					render(inst, mod) {
						// The datasets property is read from on load, but never
						// written to. It will neveer be accessed again during the ligfe cycle
						// of the Viz instance.

						// First remount any plots that are already in the system
						inst.remountPlots();

						const sets = this.datasets || [];

						// First add base graphs
						sets.forEach(set => {
							if (!set.hasOwnProperty("reference"))
								inst.addPlot(set);
						});

						// Then add derived graphs
						sets.forEach(set => {
							if (set.hasOwnProperty("reference"))
								inst.addDerivedPlot(set);
						});

						this.datasets = [];
					},
					updateDOM(inst, mod) {
						const sets = inst.queryDatasets({
								hasOwnCanvas: true
							}),
							res = inst.config.canvRes;

						for (let i = 0, l = sets.length; i < l; i++) {
							const set = sets[i],
								yAxis = inst.currentGraphData.modules.yAxis,
								bbcr = set.box.getBoundingClientRect();

							if (yAxis && set.yAxis) {
								const axCanv = set.yAxis.canvas;
								axCanv.style.width = yAxis.thickness + "px";
								axCanv.style.height = this.cHeight + "px";
								axCanv.width = yAxis.thickness * res;
								axCanv.height = set.cHeight * res;

								set.yAxis.thickness = yAxis.thickness;
							}

							set.setSize(Math.round(bbcr.width - ((set.yAxis && set.yAxis.thickness) || 0)), set.height);
						}
					},
					prePaint(inst, mod) {
						const datasets = inst.queryDatasetsMemoized("ownCanvas", {
							hasOwnCanvas: true
						});

						for (let i = 0, l = datasets.length; i < l; i++)
							datasets[i].clearCanvas();
					}
				},
				xAxis: {
					orientation: "bottom",
					draw: drawXAxis,
					thickness: 30,
					cWidth: 0,
					cWidthNatural: 0,
					cHeight: 0,
					cHeightNatural: 0,
					accessors: {
						bounding: "datarefs.dict.master"
					},
					render(inst, mod) {
						if (inst.elements.xCanv)
							this.ctx = inst.elements.xCanv.getContext("2d");
					},
					updateDOM(inst, mod) {
						const elems = inst.elements,
							modules = inst.currentGraphData.modules;

						if (!elems.xAxis)
							return;

						if (modules.yAxis) {
							const pad = modules.yAxis.orientation == "left";
							elems.xAxis.style.paddingLeft = (pad ? modules.yAxis.thickness + "px" : "");
							elems.xAxis.style.paddingRight = (!pad ? modules.yAxis.thickness + "px" : "");
						}

						this.cWidth = Math.round(elems.xCanv.getBoundingClientRect().width);
						this.cWidthNatural = this.cWidth * inst.config.canvRes;
						this.cHeight = this.thickness;
						this.cHeightNatural = this.cHeight * inst.config.canvRes;

						elems.xAxis.style.height = this.thickness + "px";
						elems.xCanv.width = this.cWidthNatural;
						elems.xCanv.height = this.thickness * inst.config.canvRes;
					},
					prePaint(inst, mod) {
						const datasets = inst.queryDatasetsMemoized("ownCanvas", {
							hasOwnCanvas: true
						});

						for (let i = 0, l = datasets.length; i < l; i++) {
							const set = datasets[i],
								xAxis = get(inst, set.accessors.xAxis);

							paintGridsAndAxes({
								inst,
								xAxis,
								xRuler: set.xAxis,
								bounding: set.bounding,
								ctx: set.ctx,
								w: set.cWidthNatural,
								h: set.cHeightNatural
							});
						}

						if (inst.elements.xAxis) {
							const cgd = inst.currentGraphData,
								accessor = this.accessor || cgd.modules.graph.defaults.accessors.xAxis;

							paintGridsAndAxes({
								inst,
								xAxis: get(inst, accessor),
								xRuler: this,
								bounding: get(inst, this.accessors.viewport),
								ctx: this.ctx,
								w: this.cWidthNatural,
								h: this.cHeightNatural
							});
						}
					}
				},
				yAxis: {
					orientation: "right",
					draw: drawYAxis,
					thickness: 50,
					cWidth: 0,
					cWidthNatural: 0,
					cHeight: 0,
					cHeightNatural: 0,
					accessors: {
						bounding: "datarefs.dict.master"
					},
					render(inst, mod) {
						if (inst.elements.yCanv)
							this.ctx = inst.elements.yCanv.getContext("2d");
					},
					updateDOM(inst, mod) {
						const elems = inst.elements,
							modules = inst.currentGraphData.modules;

						if (!elems.yAxis)
							return;

						if (modules.yAxis) {
							const pad = modules.yAxis.orientation == "left";
							elems.xAxis.style.paddingLeft = (pad ? modules.yAxis.thickness + "px" : "");
							elems.xAxis.style.paddingRight = (!pad ? modules.yAxis.thickness + "px" : "");
						}

						this.cWidth = Math.round(elems.xCanv.getBoundingClientRect().width);
						this.cWidthNatural = this.cWidth * inst.config.canvRes;
						this.cHeight = this.thickness;
						this.cHeightNatural = this.cHeight * inst.config.canvRes;

						elems.xAxis.style.height = this.thickness + "px";
						elems.vCanv.width = this.cWidthNatural;
						elems.vCanv.height = this.thickness * inst.config.canvRes;
					},
					prePaint(inst, mod) {
						const datasets = inst.queryDatasetsMemoized("ownCanvas", {
							hasOwnCanvas: true
						});

						for (let i = 0, l = datasets.length; i < l; i++) {
							const set = datasets[i],
								yAxis = get(inst, set.accessors.yAxis);

							paintGridsAndAxes({
								inst,
								yAxis,
								yRuler: set.yAxis,
								bounding: set.bounding,
								ctx: set.ctx,
								w: set.cWidthNatural,
								h: set.cHeightNatural
							});
						}
					}
				},
				overview: {
					width: null,
					height: 60,
					accessors: {
						reference: "dataRefs.dict.master"
					},
					orientation: "bottom",
					scroll: true,
					resizable: true,
					paint(inst, mod) {
						const dataset = get(inst, mod.accessor || "dataRefs.dict.master"),
							points = get(dataset, "data.points");
						let maxY = -Infinity,
							minY = Infinity;

						if (!points)
							return;

						points.forEach(d => {
							minY = Math.min(d.close, minY);
							maxY = Math.max(d.close, maxY);
						});

						const ctx = mod.ctx,
							style = inst.config.style.overview,
							w = ctx.canvas.width,
							h = ctx.canvas.height,
							minX = dataset.viewport.absStartX,
							maxX = dataset.viewport.absEndX,
							xSpan = maxX - minX;

						clearCanvas(ctx);

						ctx.fillStyle = style.fill;
						ctx.strokeStyle = style.stroke;
						ctx.lineWidth = style.width;

						ctx.beginPath();
						ctx.moveTo(-20, h + 10);
						points.forEach(p => {
							const x = Math.round(((p.time - minX) / xSpan) * w),
								y = h - Math.round(((p.close - minY) / (maxY - minY)) * (h - 10));

							ctx.lineTo(x, y);
						});
						ctx.lineTo(w + 20, h + 10);
						ctx.fill();
						ctx.stroke();

						// Set mask
						const mask = inst.elements.overviewMask,
							dd = dataset.data;
						mask.style.left = ((dd.minX - minX) / xSpan * 100) + "%";
						mask.style.width = ((dd.maxX - dd.minX) / xSpan * 100) + "%";
					},
					render(inst, mod) {
						const dataset = get(inst, mod.accessors.reference || "dataRefs.dict.master");

						if (this.scroll)
							addScrollEvt(inst, dataset, this.dom);

						if (this.resizable)
							addResizeEvt(inst, dataset, mod, mod.dom);
					},
					updateDOM(inst, mod) {
						const elem = mod.dom,
							canv = inst.elements.overviewCanv,
							yAxis = inst.elements.yAxis;

						createContexts(this, canv);
						canv.width = canv.clientWidth * inst.config.canvRes;
						canv.height = canv.clientHeight * inst.config.canvRes;
						elem.style.height = this.height + "px";
						this.width = canv.clientWidth;

						if (yAxis) {
							const conf = inst.currentGraphData.modules.yAxis;
							elem.style["margin" + (conf.orientation == "left" ? "Left" : "Right")] = conf.thickness + "px";
						}
					}
				},
				overlay: {
					labelXPos: null,
					labelYPos: null,
					render(inst, mod) {
						const wrapper = mod.dom,
							modules = inst.currentGraphData.modules,
							xAxis = modules.xAxis,
							yAxis = modules.yAxis;

						// vertical guide line, calculate position and padding as needed
						const vLine = node("div", "viz-guideline vertical").app(wrapper),
							vInner = node("div", "guideline-inner").app(vLine);

						const yOrient = get(xAxis, "orientation"),
							thisTop = (this.labelYPos || yOrient) != "bottom",
							top = yOrient != "bottom";
						vLine.classList.add(thisTop ? "pos-default" : "pos-alt");

						// horizontal guide line, calculate position and padding as needed
						const hLine = node("div", "viz-guideline horizontal").app(wrapper),
							hInner = node("div", "guideline-inner").app(hLine);

						const xOrient = get(yAxis, "orientation"),
							thisLeft = (this.labelXPos || xOrient) != "right",
							left = xOrient != "right";
						hLine.classList.add(thisLeft ? "pos-default" : "pos-alt");
						hInner.style.minWidth = get(yAxis, "thickness", null, 0) + "px";

						mod.elems.vLine = vLine;
						mod.elems.hLine = hLine;
						mod.elems.vInner = vInner;
						mod.elems.hInner = hInner;
					}
				},
				legend: {
					placeholder: "--",
					template: "no template set",
					orientation: "top",
					render(inst, mod) {
						this.elements = {
							main: inst.elements.mainLegend,
							secondary: inst.elements.secondaryLegend
						};
					},
					paint(inst, mod, data) {
						console.log("_selfKey should be implemented: ", mod.hasOwnProperty("_selfKey"));
						mod.elements[mod._key].innerHTML = renderTextTemplate(mod.template, data, null, mod.placeholder);
					}
				},
				legends: {
					fillDominant: true,
					paint(inst, mod, data) {
						inst.message(null, { legend: "paint" }, data);
					}
				},
				loader: {
					render(inst, mod) {
						const wrapper = inst.elements.loader,
							circle = node("div", "viz-loader-circle").app(wrapper);

						node("div", "viz-loader-semicircle").app(circle);
						node("div", "viz-loader-semicircle secondary").app(circle);
					}
				},
				tooltip: {
					maxIndex: 0,
					currentWrapper: null,
					global: null,
					render(inst, mod) {
						const overlay = inst.currentGraphData.modules.overlay,
							tooltip = node("div", "viz-tooltip"),
							tooltipGlobal = node("div", "viz-tooltip-global").app(tooltip),
							tooltipLocal = node("div", "viz-tooltip-local").app(tooltip);

						overlay.elems.tooltip = tooltip;
						overlay.elems.tooltipGlobal = tooltipGlobal;
						overlay.elems.tooltipLocal = tooltipLocal;

						tooltip.app(inst.elements.topOverlay);
					},
					paint(inst, mod, data) {
						inst.elements.topOverlay.classList.remove("show-tooltip");
					}
				}
			},
			hooks: {
				handleCollectedDataset(inst, dataset, collection, index) {
					if (collection.hasOwnProperty("pointDescriptor")) {
						dataset.data = collection.pointDescriptor;
						dataset.ownBounding = collection.bounding || {};
					} else {
						dataset.data = collection;
						dataset.ownBounding = {};
					}

					const refB = getTargetBounding(dataset),
						ownB = dataset.ownBounding;

					// set canvas bounding if the dataset maps to a rectangular
					// drawing area which has to fit into the viewport.
					if (refB != ownB && dataset.boxLayout && dataset.refDataset) {
						const pBounding = dataset.propagateBounding || {};

						if (pBounding.minX) refB.minX = Math.min(ownB.minX, refB.minX);
						if (pBounding.minY) refB.minY = Math.min(ownB.minY, refB.minY);
						if (pBounding.maxX) refB.maxX = Math.max(ownB.maxX, refB.maxX);
						if (pBounding.maxY) refB.maxY = Math.max(ownB.maxY, refB.maxY);

						refB.spanX = refB.maxX - refB.minX;
						refB.spanY = refB.maxY - refB.minY;
					}

					if (dataset.useOwnBounding || !dataset.refDataset || !dataset.boxLayout) {
						dataset.bounding = inject(dataset.bounding, dataset.ownBounding, {
							cloneTarget: true,
							override: true
						});
					} else
						dataset.bounding = dataset.refDataset.bounding;

					if (!index || !dataset.data || !dataset.boxLayout) // ||dataset.derived
						return;

					const vp = getTargetViewport(dataset);
					let xMin = dataset.ownBounding.absMinX,
						xMax = dataset.ownBounding.absMaxX,
						yMin = dataset.ownBounding.absMinY,
						yMax = dataset.ownBounding.absMaxY;

					if (isFiniteNum(xMin + xMax)) {
						vp.absStartX = xMin;
						vp.absEndX = xMax;
						vp.absSpanX = xMax - xMin;

						// If the viewport isn't set, set the viewport X axis to the span of the collection
						if (vp.startX == null)
							vp.startX = xMin;
						if (vp.endX == null)
							vp.endX = xMax;
					}

					if (isFiniteNum(yMin + yMax)) {
						vp.absStartY = yMin;
						vp.absEndY = yMax;
						vp.absSpanY = yMax - yMin;

						// If the viewport isn't set, set the viewport X axis to the span of the collection
						if (vp.startY == null)
							vp.startY = yMin;
						if (vp.endY == null)
							vp.endY = yMax;
					}
				}
			},
			datasets: []
		}
	};
}

export default {
	get: getter,
	cachePolicy: "same-config",
	assets: {
		clearCanvas,
		createContexts,
		paintGridsAndAxes,
		drawXAxis,
		drawYAxis,
		addScrollEvt,
		addResizeEvt,
		getTargetBounding,
		getTargetViewport
	}
};
