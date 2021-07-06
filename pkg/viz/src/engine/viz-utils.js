import {
	get,
	hasOwn,
	coerceNum,
	isFiniteNum
} from "@qtxr/utils";

import EVT from "@qtxr/evt";

import { node } from "../utils";

import CTX2D from "../utilities/ctx2d";
import Undoable from "../utilities/undoable";

const ctxConfig = {
	modifiers: {
		add(data, dataset) {
			if (hasOwn(data, "x"))
				data.x /= dataset._owner.config.canvRes;
		}
	}
};

function createContexts(dataset, canvas) {
	const sameCanvas = !!(dataset.ctxProxy && dataset.ctxProxy.canvas == canvas);

	if (dataset.ctxProxy instanceof CTX2D && !sameCanvas)
		dataset.ctxProxy.destroy();

	if (canvas instanceof HTMLCanvasElement) {
		dataset.ctx = canvas.getContext("2d");
		if (!sameCanvas)
			dataset.ctxProxy = new CTX2D(dataset.ctx, dataset, null, ctxConfig);

		dataset.ctx.log = _ => console.log("nop");
		dataset.ctx.add = _ => console.log("nop");
	} else {
		dataset.ctx = null;
		dataset.ctxProxy = null;
	}
}

function copyContexts(to, from) {
	to.ctx = from.ctx;
	to.ctxProxy = from.ctxProxy;
}

function warningFlagEnabled(warningFlags, accessor, preferred) {
	preferred = preferred === undefined ? true : preferred;
	return get(warningFlags, accessor) === true;
}

// Standard functions. These are used by the modules in the graph and many are exported
function clearCanvas(ctx) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function clearSVG(svg) {
	const children = svg.childNodes;
	for (let i = children.length - 1; i >= 0; i--)
		svg.removeChild(children[i]);
}

// Will be bound to a dataset, as this will be injected into datasets in injectDatasetDependencies
function clearCanvasDS() {
	if (this.canvasType == "canvas")
		clearCanvas(this.ctx);
	else
		clearSVG(this.canvas);
}

// ====== Grids and axes =======

// Widget functions. These are called when the graph is re-rendered
// and their task is to update the widgets in the graph, such as
// graph axes and graph overview windows
function paintGridsAndAxes({ inst, xAxis, yAxis, xRuler, yRuler, bounding, ctx, w, h }) {
	const style = inst.config.style.grid;

	if (!bounding)
		return;

	if (yAxis) {
		const key = yAxis.type + Math.floor(bounding.minY) + Math.floor(bounding.maxY) + "-" + w + "x" + h;

		inst.cache.request("paint", key, _ => {
			return calcMarkings(yAxis.extract(bounding.minY, bounding.maxY, h), mapY, bounding, h);
		}, markings => {
			markings.forEach(markingsData => {
				ctx.fillStyle = style[markingsData.style.line];
				markingsData.markings.forEach(({ marking }) => ctx.fillRect(0, marking, w, 1));
			});

			if (yRuler && yRuler.draw)
				yRuler.draw(inst, yRuler, markings, h);
		}, true);
	}

	if (xAxis) {
		inst.cache.request("paint", "xAxis", _ => {
			return calcMarkings(xAxis.extract(bounding.minX, bounding.maxX, w), mapX, bounding, w);
		}, markings => {
			markings.forEach(markingsData => {
				ctx.fillStyle = style[markingsData.style.line];
				markingsData.markings.forEach(({ marking }) => ctx.fillRect(marking, 0, 1, h));
			});

			if (xRuler && xRuler.draw)
				xRuler.draw(inst, xRuler, markings, w);
		}, true);
	}
}

function calcMarkings(markings, map, bounding, basis) {
	if (!markings)
		return;

	for (let i = markings.length - 1; i >= 0; i--) {
		const m = markings[i].markings;

		for (let j = 0, l2 = m.length; j < l2; j++)
			m[j].marking = Math.round(map(m[j].marking, bounding, basis));
	}

	return markings;
}

function drawXAxis(inst, mod, markings, w) {
	const style = inst.config.style.axes,
		gridStyle = inst.config.style.grid,
		ctx = mod.ctx,
		h = mod.thickness,
		res = inst.config.canvRes,
		top = mod.orientation == "top" ? h * res : 0,
		dy = mod.orientation == "top" ? -res : 0,
		dySigned = (dy ? -1 : 1) * res;

	clearCanvas(ctx);

	// Draw dividing line
	ctx.fillStyle = style.lines;
	ctx.fillRect(0, top + dy, w, 1);

	// Draw labels, etc.
	ctx.textAlign = "center";
	ctx.textBaseline = dy ? "bottom" : "top";
	ctx.font = style.font;
	for (let i = markings.length - 1; i >= 0; i--) {
		const m = markings[i].markings,
			lineCol = gridStyle[markings[i].style.line],
			textCol = style[markings[i].style.line];

		for (let j = 0, l2 = m.length; j < l2; j++) {
			const left = m[j].marking;
			ctx.fillStyle = lineCol;
			ctx.fillRect(left, top + dy * 10, res / 2, res * 10);
			ctx.fillStyle = textCol;
			ctx.fillText(m[j].label, left, top + dySigned * 14);
		}
	}
}

function drawYAxis(inst, mod, markings, h) {
	const style = inst.config.style.axes,
		gridStyle = inst.config.style.grid,
		ctx = mod.ctx,
		w = mod.thickness,
		res = inst.config.canvRes,
		left = mod.orientation == "left" ? w * res : 0,
		dx = mod.orientation == "left" ? -res : 0,
		dxSigned = (dx ? -1 : 1) * res;

	clearCanvas(ctx);

	// Draw dividing line
	ctx.fillStyle = style.lines;
	ctx.fillRect(left + dx, 0, 1, h);

	// Draw labels, etc.
	ctx.textAlign = dx ? "right" : "left";
	ctx.textBaseline = "middle";
	ctx.font = style.font;
	for (let i = markings.length - 1; i >= 0; i--) {
		const m = markings[i].markings,
			lineCol = gridStyle[markings[i].style.line],
			textCol = style[markings[i].style.line];

		for (let j = 0, l2 = m.length; j < l2; j++) {
			const top = m[j].marking;
			ctx.fillStyle = lineCol;
			ctx.fillRect(left + dx * 10, top, 10 * res, res / 2);
			ctx.fillStyle = textCol;
			ctx.fillText(m[j].label, left + dxSigned * 14, top);
		}
	}
}

function mapX(val, range, basis) {
	return Math.round(((val - range.minX) / (range.maxX - range.minX)) * basis);
}

function mapY(val, range, basis) {
	return Math.round(basis - ((val - range.minY) / (range.maxY - range.minY)) * basis);
}

// ====== Events =======
function addScrollEvt(inst, dataset, wrapper) {
	wrapper.addEventListener("wheel", evt => {
		const vp = getTargetViewport(dataset), // inst.currentGraphData.state.viewport,
			span = vp.endX - vp.startX;

		if (Math.abs(evt.deltaY) > Math.abs(evt.deltaX)) {
			const x = vp.startX + (EVT.getCoords(evt, wrapper).x / wrapper.clientWidth) * span,
				zoom = zoomFromPoint(x, vp.startX, vp.endX, evt.deltaY * (span / 500));
			inst.setViewportX(dataset, zoom.start, zoom.end, { perc: zoom.perc });
		} else {
			const delta = evt.deltaX * (span / 500);
			inst.setViewportX(dataset, vp.startX + delta, vp.endX + delta);
		}

		inst.throttledUpdate();
		evt.preventDefault();
	}, { passive: false });
}

// At the moment, this is limited to the overview panel, but can and should be extended if needed.
function addResizeEvt(inst, dataset, mod, wrapper) {
	const mask = inst.elements.overviewMask,
		handleL = node("div", "viz-overview-handle").app(mask),
		handleR = node("div", "viz-overview-handle right").app(mask),
		body = document.body,
		vp = getTargetViewport(dataset);

	let offs = 0,
		maskWidth = 0,
		dragging = false,
		resizeDir = 0,
		maskPoints = { p1: 0, p2: 0 };

	mask.classList.add("draggable");

	handleL.addEventListener("mousedown", startResize);
	handleL.addEventListener("touchstart", startResize);
	handleR.addEventListener("mousedown", startResize);
	handleR.addEventListener("touchstart", startResize);
	mask.addEventListener("mousedown", startMove);
	mask.addEventListener("touchstart", startMove);
	registerEvent(inst, body, "mousemove", move);
	registerEvent(inst, body, "touchmove", move, { passive: false });
	registerEvent(inst, body, "mouseup", drop);
	registerEvent(inst, body, "touchend", drop);

	function startMove(evt) {
		const x = EVT.getCoords(evt, mask).x;
		offs = x;
		maskWidth = mask.clientWidth;
		dragging = true;
		mask.classList.add("dragging");
	}

	function startResize(evt) {
		resizeDir = this.classList.contains("right") ? 1 : -1;
		const bcrMask = mask.getBoundingClientRect(),
			bcrWrapper = wrapper.getBoundingClientRect();

		inst.flags.resizing = true;

		maskPoints = {
			p1: bcrMask.left - bcrWrapper.left,
			p2: bcrMask.right - bcrWrapper.left
		};
		evt.stopPropagation();
	}

	function move(evt) {
		if (dragging) {
			const x = EVT.getCoords(evt, wrapper).x - offs;
			updateResizer(x, x + maskWidth);
		} else if (resizeDir) {
			const x = EVT.getCoords(evt, wrapper).x,
				mp = maskPoints;

			if (resizeDir == 1)
				mp.p2 = Math.max(x, mp.p1 + 1);
			else
				mp.p1 = Math.min(x, mp.p2 - 1);

			updateResizer(mp.p1, mp.p2);
		}
	}

	// Drop ends dragging and resizing
	function drop() {
		dragging = false;
		resizeDir = 0;
		inst.flags.resizing = false;
		mask.classList.remove("dragging");
	}

	function updateResizer(p1, p2) {
		const wWidth = mod.width,
			leftPerc = p1 / wWidth,
			widthPerc = (p2 - p1) / wWidth,
			xStart = vp.absStartX,
			xSpan = vp.absSpanX,
			xLeft = xStart + leftPerc * xSpan;

		// Update mask DOM
		mask.style.left = leftPerc * 100 + "%";
		mask.style.width = widthPerc * 100 + "%";

		// Update graph
		inst.setViewportX(dataset, xLeft, xLeft + widthPerc * xSpan, {
			acceptNull: true,
			padding: {
				l: -vp.l,
				r: -vp.r
			},
			compensatePadding: true
		});
		inst.update();
		delete vp.padding;
	}
}

// Global scope data handling. These functions manage data that have to be
// used outside of the graph area. If this is the case, these may need to be reset
// on graph re-render, for example
function registerEvent(inst, elem, type, listener, options) {
	const undoable = Undoable.as("event").do(elem, type, listener, options);
	inst.globalData.events.push(undoable);
	return undoable;
}

function zoomFromPoint(point, start, end, factor) {
	const perc = (point - start) / (end - start);

	return {
		start: start - factor * perc,
		end: end + (1 - perc) * factor,
		perc: perc
	};
}

// ====== Boundings =======
function getTargetBounding(dataset) {
	if (dataset.derived && !dataset.useOwnDataset)
		return dataset.refDataset.bounding;
	return dataset.bounding;
}

// ====== Viewports =======
function getTargetViewport(dataset) {
	if (dataset.derived && !dataset.useOwnViewport)
		return dataset.refDataset.viewport;
	return dataset.viewport;
}

function getUnsuffixedViewportData(inst, dataset, key) {
	key = "" + key;
	const upKey = key.toUpperCase(),
		lowKey = key.toLowerCase(),
		propNames = ["start", "end", "absStart", "absEnd"],
		vp = getTargetViewport(dataset),
		out = {};

	if (key.length != 1 || "xy".indexOf(lowKey) == -1)
		throw new RangeError(`Key '${key}' is not supported.`);

	propNames.forEach(name => {
		out[name] = vp[name + upKey];
	});

	out.target = lowKey;
	out.span = out.end - out.start;
	out.hasSpan = isFiniteNum(out.span);
	out.absSpan = out.absEnd - out.absStart;
	out.hasAbsSpan = isFiniteNum(out.absSpan);

	return out;
}

function autoViewport(inst, dataset, baseArgs, args) {
	args = args || {};
	baseArgs.duration = args.duration || 500;
	const ba = baseArgs,
		to = args.to || "full";

	switch (to) {
		case "full":
			setArgsPoints(ba.start, ba.end, ba.absStart, ba.absEnd);
			break;
		case "end":
			if (ba.hasSpan)
				setArgsPoints(ba.start, ba.end, ba.absEnd - ba.span, ba.absEnd);
			break;
		case "start":
			if (ba.hasSpan)
				setArgsPoints(ba.start, ba.end, ba.absStart, ba.absStart + ba.span);
			break;
		default:
			if (Array.isArray(to))
				setArgsPoints(ba.start, ba.end, to[0], to[1]);
	}

	function setArgsPoints(sMin, sMax, eMin, eMax) {
		baseArgs.startMin = sMin;
		baseArgs.startMax = sMax;
		baseArgs.endMin = eMin;
		baseArgs.endMax = eMax;
	}

	return inst.setViewport(dataset, baseArgs);
}

// CONFIG - acceptNull,perc,noPadding
// acceptNull - accept null as a start/end value, setting the viewport automatically
function setViewport(inst, dataset, start, end, startKey, endKey, config) {
	const vp = getTargetViewport(dataset); // cgd.state.viewport;

	config = config || {};
	start = (typeof start == "number" || start === null && config.acceptNull) ? start : vp[startKey];
	end = (typeof end == "number" || end === null && config.acceptNull) ? end : vp[endKey];

	if (start !== null && end !== null) {
		if (start > end) {
			start = (start + end) / 2 - 0.5;
			end = start + 1;
		}

		// Temporary stuff
		if (endKey.indexOf("X") > -1 && vp.absStartX && inst.config.lockViewport) {
			const minW = vp.absSpanX / 100,
				currSpan = end - start,
				prc = coerceNum(config.perc, 0.5);

			if (currSpan < minW) {
				start += (currSpan - minW) * prc;
				end += (minW - currSpan) * (1 - prc);
			}

			start = Math.max(start, vp.absStartX);
			end = Math.min(end, vp.absEndX);
		}
	}

	Object.assign(vp, config);
	vp[startKey] = start;
	vp[endKey] = end;
	inst.messenger.post("setViewport", arguments);
}

export {
	createContexts,
	copyContexts,
	warningFlagEnabled,
	clearCanvas,
	clearSVG,
	clearCanvasDS,
	// Grids and axes
	paintGridsAndAxes,
	drawXAxis,
	drawYAxis,
	mapX,
	mapY,
	// Events
	addScrollEvt,
	addResizeEvt,
	registerEvent,
	// Boundings
	getTargetBounding,
	// Viewports
	getTargetViewport,
	getUnsuffixedViewportData,
	autoViewport,
	setViewport
};
