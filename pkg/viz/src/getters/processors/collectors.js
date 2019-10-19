import {
	getClosestIndex,
	multiMinMax
} from "../../utils";

/*
*	Collectors must return data that the main program can access uniformly:
*	{
*		points: <original/processed data>,
*		minY: <minimum Y value>,
*		maxY: <maximum Y value>,
*		minX: <minimum X value>,
*		maxV: <maximum X value>
*	}
*/

// IMPORTANT: Collector data should never be mutated, only displayed. This is because
// collectors generally only pass data through the pipeline. If data is mutated, it
// may disrupt other parts of the program.

// data		- data to collect/transform
// span		- data span (start - end)
// inst		- Viz instance
// index	- boolean:	true  -> index and store data (implementation optional)
//						false -> set data for inferral/use by plotters

const getters = {
	// Type 0 collectors: run on input data and both index and calculate output data.
	line(config, assets, r) {
		const {
			domainKey,
			codomainKey
		} = config;

		return p => {
			if (p.index)
				return compileCollector(p.data.points, Infinity, -Infinity, domainKey, 0, p.data.points.length - 1, p);
			else {
				const points = p.data.points,
					minX = getClosestIndex(points, p.viewport.startX, domainKey),
					maxX = getClosestIndex(points, p.viewport.endX, domainKey),
					mm = multiMinMax(points, minX, maxX, codomainKey);

				return compileCollector(points, mm.min, mm.max, domainKey, minX, maxX, p);
			}
		};
	}
};

// ====== Compiler helpers ======
function compileCollector(data, minY, maxY, key, startIdx, endIdx, p) {
	if (!data || !data.length)
		return null;

	// If possible, offset the endIdx by one to make the plotters
	// render an extra data item out of frame.
	if (endIdx < data.length - 1)
		endIdx++;

	const vp = p.viewport;// p.inst.currentGraphData.state.viewport;
	let padding = Object.assign({}, p.dataset.padding);

	if (p.dataset.position != "absolute") {
		minY = vp.startY == null ? minY : vp.startY;
		maxY = vp.endY == null ? maxY : vp.endY;
	}

	if (vp.padding)
		Object.assign(padding, vp.padding);

	if (p.dataset.noPadding)
		padding = { t: 0, r: 0, b: 0, l: 0 };

	const sX = data[startIdx][key],
		eX = data[endIdx][key],
		minX = vp.startX == null ? sX : vp.startX,
		maxX = vp.endX == null ? eX : vp.endX,
		refDataset = p.dataset.refDataset || p.dataset,
		w = refDataset.cWidth - padding.l - padding.r,
		h = refDataset.cHeight - padding.t - padding.b,
		padFactorX = (maxX - minX) / w,
		padFactorY = (maxY - minY) / h,
		minXOut = minX - (padFactorX * padding.l),
		maxXOut = maxX + (padFactorX * padding.r),
		minYOut = minY - (padFactorY * padding.t),
		maxYOut = maxY + (padFactorY * padding.b);

	const pointDescriptor = {
		points: data,
		startIdx: startIdx,
		endIdx: endIdx,
	};

	const bounding = {
		type: "cartesian",
		minY: minYOut,
		maxY: maxYOut,
		minX: minXOut,
		maxX: maxXOut,
		spanX: maxXOut - minXOut,
		spanY: maxYOut - minYOut,
		minXBounded: Math.max(sX, minX) - (padFactorX * padding.l),
		maxXBounded: Math.min(eX, maxX) + (padFactorX * padding.r)
	};

	if (p.index) {
		bounding.absMinX = sX;
		bounding.absMaxX = eX;
	}

	return {
		pointDescriptor,
		bounding
	};
}

export default {
	getters,
	cachePolicy: "same-config",
	config: {
		domainKey: "x",
		codomainKey: "y"
	},
	assets: {
		compileCollector,
		getClosestIndex,
		multiMinMax
	}
};
