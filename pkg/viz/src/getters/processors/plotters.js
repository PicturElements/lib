const getters = {
	line(config, assets, r) {
		return p => {
			plotMountain(p, {
				style: p.inst.config.style.line,
				stroke: true,
				coordKeys: {
					x: config.domainKey,
					y: config.codomainKey
				}
			});
		};
	},

};

function plotMountain(p, { style, stroke = false, fill = false, coordKeys = {}, log = true, padPoints = 0 }) {
	const points = getPlotPoints(
			p.dataset,
			p.canvas,
			p.bounding,
			coordKeys.x,
			coordKeys.y,
			true,
			padPoints
		),
		ctx = p.context,
		h = p.canvas.height;

	ctx.beginPath();

	for (let i = 0, l = points.length; i < l; i++) {
		if (log)
			ctx.log({ x: points[i].x }, points[i].data);

		if (i)
			ctx.lineTo(points[i].x, points[i].y);
		else
			ctx.moveTo(points[i].x, points[i].y);
	}

	if (stroke) {
		ctx.strokeStyle = style.stroke;
		ctx.lineWidth = style.width || 4;
		ctx.stroke();
	}

	if (fill) {
		setFill(style.fill, ctx, h);
		ctx.lineTo(points[points.length - 1].x, h);
		ctx.lineTo(points[0].x, h);
		ctx.fill();
	}

	p.inst.updatePlotIndex(ctx);
}

// This could theoretically be abstracted to an OCML fetcher function with a callback.
function plotBar(p, style, colored) {
	const ctx = p.context,
		pts = p.points,
		bounding = p.bounding,
		w = p.canvas.width,
		h = p.canvas.height,
		activeWidth = mapXRel(bounding.maxXBounded - bounding.minXBounded, bounding, w),
		start = p.data.startIdx,
		end = p.data.endIdx + 1,
		barWidth = Math.min(Math.floor(activeWidth / (end - start) * 0.15) * 1 + 1, 80) * p.inst.config.canvRes;

	for (let i = start; i < end; i++) {
		const pt = pts[i],
			left = mapX(pt.time, bounding, w),
			top = mapY(pt.high, bounding, h),
			height = mapYRel(pt.high - pt.low, bounding, h);

		ctx.log({ x: left }, pt);

		const openTop = mapY(pt.open, bounding, h),
			closeTop = mapY(pt.close, bounding, h);

		ctx.strokeStyle = colored ? (pt.open > pt.close ? style.negative : style.positive) : style.stroke;
		ctx.lineWidth = style.width || 2;
		// Turns out repeating yourself here is way more
		// performant than only stroking once.
		ctx.beginPath();
		ctx.moveTo(left, top);
		ctx.lineTo(left, top + height);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(left, openTop);
		ctx.lineTo(left - barWidth, openTop);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(left, closeTop);
		ctx.lineTo(left + barWidth, closeTop);
		ctx.stroke();
	}

	p.inst.updatePlotIndex(ctx);
}

function plotBasic(p, styleKey, plotKey, skip) {
	let style = null,
		strokeKey = "stroke";

	if (styleKey && typeof styleKey == "object") {
		style = styleKey.style;
		strokeKey = styleKey.key;
	} else
		style = p.inst.config.style[styleKey];

	let start = p.data.startIdx,
		end = p.data.endIdx;

	if (skip)
		start = skipFirst(start);

	p.context.lineWidth = style.width || 2;
	p.context.strokeStyle = style[strokeKey];
	plotLine(p.context, p.points, "time", plotKey, p.bounding, start, end);
}

function plotLine(ctx, pts, keyX, keyY, bounding, start, end) {
	const canvas = ctx.canvas,
		w = canvas.width,
		h = canvas.height;

	ctx.beginPath();

	for (let i = start; i <= end; i++) {
		const pt = pts[i],
			x = mapX(pt[keyX], bounding, w),
			y = mapY(pt[keyY], bounding, h);

		if (i == start)
			ctx.moveTo(x, y);
		else
			ctx.lineTo(x, y);
	}

	ctx.stroke();
}

function plotCandle(p, style, hollow) {
	const ctx = p.context,
		bounding = p.bounding,
		ds = p.dataset,
		pts = ds.data.points,
		w = p.canvas.width,
		h = p.canvas.height,
		activeWidth = mapXRel(bounding.maxXBounded - bounding.minXBounded, bounding, w);
	let start = p.data.startIdx,
		end = p.data.endIdx + 1,
		candleWidth = Math.min(Math.floor(activeWidth / (end - start) * 0.3) * 1 + 1, 80) * p.inst.config.canvRes;

	if (hollow)
		start = Math.max(start - 1, 1);

	ctx.lineWidth = style.width || 3;

	for (let i = start; i < end; i++) {
		const pt = pts[i],
			left = mapX(pt.time, bounding, w),
			wickTop = mapY(pt.high, bounding, h),
			wickHeight = mapYRel(pt.high - pt.low, bounding, h),
			top = Math.max(pt.open, pt.close),
			waxTop = mapY(top, bounding, h),
			waxHeight = mapYRel(Math.abs(pt.open - pt.close), bounding, h);

		ctx.log({ x: left }, pt);

		if (hollow) {
			const col = pt.close > pts[i - 1].close ? style.positive : style.negative;
			ctx.strokeStyle = col;
			ctx.fillStyle = col;

			ctx.beginPath();
			ctx.moveTo(left, wickTop);
			ctx.lineTo(left, waxTop);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(left, waxTop + waxHeight);
			ctx.lineTo(left, wickTop + wickHeight);
			ctx.stroke();

			ctx[pt.open > pt.close ? "strokeRect" : "fillRect"](left - Math.floor(candleWidth / 2), waxTop, candleWidth, waxHeight);
		} else {
			ctx.strokeStyle = style.wick;
			ctx.beginPath();
			ctx.moveTo(left, wickTop);
			ctx.lineTo(left, wickTop + wickHeight);
			ctx.stroke();
			ctx.fillStyle = pt.open > pt.close ? style.negative : style.positive;
			ctx.fillRect(left - Math.floor(candleWidth / 2), waxTop, candleWidth, waxHeight);
		}
	}

	p.inst.updatePlotIndex(ctx);
}

function plotSuccessiveLines(p, styleKey, plotKeys, skip) {
	for (let i = plotKeys.length - 1; i >= 0; i--) {
		plotBasic(p, {
			style: p.inst.config.style[styleKey || "successive"],
			key: i
		}, plotKeys[i], skip);
	}
}

// Basic function that returns an array of points
function getPlotPoints(dataset, canvas, bounding, keyX, keyY, fullData, padPoints = 0) {
	const pts = dataset.data.points,
		w = canvas.width,
		h = canvas.height,
		start = Math.max(dataset.data.startIdx - padPoints, 0),
		end = Math.min(dataset.data.endIdx + padPoints, pts.length - 1),
		out = [];

	// Return some data, just to make sure nothing breaks
	// In real life, this occurrence is rare and should only
	// cause a single moveTo in the end.
	if (!pts.length)
		return [];

	for (let i = start; i <= end; i++) {
		const x = mapX(pts[i][keyX], bounding, w),
			y = mapY(pts[i][keyY], bounding, h);

		if (fullData) {
			out.push({
				data: pts[i],
				x: x,
				y: y
			});
		} else
			out.push([x, y]);
	}

	return out;
}

// If the fill is an array, create a gradient, else set fill color
function setFill(val, ctx, h) {
	if (Array.isArray(val)) {
		const stops = conformGradient(val),
			grad = ctx.createLinearGradient(0, 0, 0, h);

		for (let i = 0, l = stops.length; i < l; i += 2)
			grad.addColorStop(stops[i + 1], stops[i]);

		ctx.fillStyle = grad;
	} else
		ctx.fillStyle = val;
}

// Conforms and completes gradient arrays
// ["red", "green", "blue"] -> ["red", 0, "green", 0.5, "blue", 1]
// ["red", "green", "blue", 0.6, "lilac"] -> ["red", 0, "green", 0.3, "blue", 0.6, "lilac", 1]
function conformGradient(arr) {
	if (!arr.length)
		return arr;

	// Fill in missing numbers
	for (let i = 0; i < arr.length; i++) {
		if ((i % 2) == 0 && typeof arr[i + 1] != "number") {
			arr.splice(i + 1, 0, -1);
		}
	}

	const len = arr.length;
	let last = 0,
		next = 0;

	// Set default values of first and last step if needed
	if (arr[1] == -1) arr[1] = 0;
	if (arr[len - 1] == -1) arr[len - 1] = 1;

	for (let i = 1; i < len; i += 2) {
		if (arr[i] > -1 && !last)
			last = i;
		if (arr[i] > -1 && last) {
			if (i > last + 2)
				next = i;
			else
				last = i;
		}

		if (last && next) {
			const diff = arr[next] - arr[last],
				split = (next - last);

			for (let j = last + 2; j < next; j += 2)
				arr[j] = arr[last] + diff * ((j - last) / split);

			last = i;
			next = 0;
		}
	}

	return arr;
}

function mapX(val, bounding, basis) {
	return Math.round(((val - bounding.minX) / (bounding.maxX - bounding.minX)) * basis);
}

function mapXRel(val, bounding, basis) {
	return Math.round((val / (bounding.maxX - bounding.minX)) * basis);
}

function mapY(val, bounding, basis) {
	return Math.round(basis - ((val - bounding.minY) / (bounding.maxY - bounding.minY)) * basis);
}

function mapYRel(val, bounding, basis) {
	return Math.round((val / (bounding.maxY - bounding.minY)) * basis);
}

function skipFirst(idx) {
	if (!idx)
		return 1;
	return idx;
}

export default {
	getters,
	cachePolicy: "same-config",
	config: {
		domainKey: "x",
		codomainKey: "y"
	},
	assets: {
		// Painting utils
		plotBar,
		plotBasic,
		plotCandle,
		plotLine,
		plotMountain,
		plotSuccessiveLines,
		// Data utils
		getPlotPoints,
		mapX,
		mapY,
		mapXRel,
		mapYRel
	}
};
