import {
	hasOwn,
	forEach,
	memoize,
	mergesort,
	parseArgStr
} from "@qtxr/utils";

const pi = Math.PI,
	piHalf = pi / 2,
	sin = Math.sin,
	cos = Math.cos,
	sqrt = Math.sqrt,
	pow = Math.pow;

const Ease = {
	DEFAULT_EASING: "linear",
	compile(easingData, ...args) {
		easingData = easingData || this.DEFAULT_EASING;
		const easings = this.easings;

		switch (typeof easingData) {
			case "string": {
				if (hasOwn(easings.cache, easingData))
					return easings.cache[easingData];
				if (hasOwn(easings.pure, easingData))
					return easings.pure[easingData];
				if (hasOwn(easings.factory, easingData))
					return easings.factory[easingData](...args);

				const ex = Ease.regexes.matchStart.exec(easingData);
				if (ex && ex[2]) {
					const name = ex[1].split("(")[0],
						easing = easings.factory[name](
							...parseArgStr(ex[2])
						);

					easings.cache[easingData] = easing;
					return easing;
				}

				break;
			}

			case "function":
				return easingData;
		}

		console.warn("Failed to compile easing function", easingData);
		if (easingData != this.DEFAULT_EASING)
			return this.compile(this.DEFAULT_EASING);
		else
			throw new Error("Fatal: failed to resolve default easing");
	},
	ease(easing, position, ...args) {
		// Eliminates unnecessary processing,
		// over/undershooting input,
		// and reduces floating point rounding errors
		// in key positions
		if (position <= 0)
			position = 0;
		else if (position >= 1)
			position = 1;

		// Assumes easing is a function
		// No checks are being made to save time
		return easing(position, ...args);
	},
	define(name, type, func) {
		if (!name || typeof name != "string")
			return console.warn(`Failed to define easing: '${name}' is not a valid name`);

		if (type != "pure" && type != "factory")
			return console.warn(`Failed to define easing: '${type}' is not a valid easing type`);

		if (typeof func != "function")
			return console.warn(`Failed to define easing: no valid function defined`);

		this.easings[type][name] = func;
		updateRegexes();
	},
	isEasingData(candidate) {
		return typeof candidate == "string";
	},
	easings: {
		// Pure easings that don't rely on external data
		pure: {
			linear: at => at,
			"ease-in": at => 1 - cos(at * piHalf),
			"ease-out": at => sin(at * piHalf),
			"ease-in-out": at => (1 + sin((at - 0.5) * pi)) / 2,
			"ease-in-quad": at => pow(at, 2),
			"ease-out-quad": at => 1 - pow(at - 1, 2),
			"ease-in-cubic": at => pow(at, 3),
			"ease-out-cubic": at => pow(at - 1, 3) + 1,
			"ease-in-quart": at => pow(at, 4),
			"ease-out-quart": at => 1 - pow(at - 1, 4),
			"ease-in-quint": at => pow(at, 5),
			"ease-out-quint": at => pow(at - 1, 5) + 1,
			"circle-in": at => 1 - sqrt(1 - pow(at, 5)),
			"circle-out": at => sqrt(1 - pow(at - 1, 2))
		},
		// Easing factories
		factory: {
			"cubic-bezier": (x, y, x2, y2, accuracy) => {
				accuracy = accuracy || 1000;
				const interpResolution = accuracy * 10,
					frames = memoize(calcBezier, x, y, x2, y2, accuracy, interpResolution);

				return at => {
					const idx = ~~(at * interpResolution),
						perc = (at * interpResolution) % 1;
					return frames[idx] + perc * (frames[idx + 1] - frames[idx]);
				};
			},
			"pseudo-bezier": (inStrength = 0, outStrength = 0) => at => {
				const invT = 1 - at,
					inComp = ((inStrength * at * invT) + (at * at)) * invT,
					outComp = (1 - (outStrength * invT * at) - (invT * invT)) * at;

				return inComp + outComp;
			},
			steps: (steps = 1, jump = "end") => {
				if (typeof steps != "number" || !isFinite(steps) || isNaN(steps))
					throw new Error(`Incorrect steps value: ${steps}`);

				const minSteps = jump == "jump-none" ? 2 : 1;

				if (steps < minSteps)
					throw new RangeError(`Incorrect step count for ${jump}: this function expects a step value of at least ${minSteps}`);

				return at => {
					switch (jump) {
						case "jump-both":
							return at >= 1 ? 1 : Math.ceil(at * steps) / (steps + 1);
						case "jump-none":
							return Math.min(Math.floor(at * steps) / (steps - 1), 1);
						case "jump-start":
						case "start":
							return Math.ceil(at * steps) / steps;
						case "jump-end":
						case "end":
						default:
							return Math.floor(at * steps) / steps;
					}
				};
			}
		},
		cache: {}
	},
	regexes: {
		match: null,
		matchStart: null,
		matchEnd: null
	}
};

// Bézier curve approximator
// This function approximates a Bézier curve as a number of points spread evenly
// along the X axis so that x-y correspondence can be efficiently interpolated
const bezOutMap = typeof Float64Array == "undefined" ? Float64Array : Array;

function calcBezier(adx, ady, offsX, offsY, steps, interpolationResolution) {
	const bdx = 1 - offsX,
		bdy = 1 - offsY,
		cdx = offsX - adx,
		cdy = offsY - ady,
		outMap = new bezOutMap(interpolationResolution + 2);

	let q1x = 0,
		q2x = 0,
		q3x = 0,
		q1y = 0,
		q2y = 0,
		q3y = 0,
		step = 0,
		nextPos = 0,
		outStep = 0,
		c = [0, 0],
		c2 = calcCoordinate(1 / steps);

	while (step < steps) {
		if (c2[0] < nextPos) {
			step++;

			c = c2;
			c2 = calcCoordinate((step + 1) / steps);
			continue;
		}

		// const perc = (nextPos - c[0]) / (c2[0] - c[0]);
		outMap[outStep] = (c[1] + ((nextPos - c[0]) / (c2[0] - c[0])) * (c2[1] - c[1]));
		nextPos = (++outStep) / interpolationResolution;
	}

	outMap[outStep] = 1;
	return outMap;

	function calcCoordinate(at) {
		// First pass
		q1x = adx * at;
		q1y = ady * at;
		q2x = adx + cdx * at;
		q2y = ady + cdy * at;
		q3x = offsX + bdx * at;
		q3y = offsY + bdy * at;

		// Second pass
		q1x = q1x + (q2x - q1x) * at;
		q1y = q1y + (q2y - q1y) * at;
		q2x = q2x + (q3x - q2x) * at;
		q2y = q2y + (q3y - q2y) * at;

		// Third pass
		return [
			q1x + (q2x - q1x) * at,
			q1y + (q2y - q1y) * at
		];
	}
}

function updateRegexes() {
	const easingNames = {},
		easingInitials = {},
		easingInitialsArr = [],
		easingSecondChars = {},
		easingSecondCharsArr = [];

	let easingPureNamesArr = [],
		easingMakerNamesArr = [];

	forEach([
			[Ease.easings.pure, easingPureNamesArr],
			[Ease.easings.factory, easingMakerNamesArr]
		], ([partition, nameArr]) => {

		forEach(partition, (_, name) => {
			if (hasOwn(easingNames, name))
				throw new Error(`Found duplicate easing function by name '${name}'`);
			easingNames[name] = true;
			nameArr.push(name);

			if (!hasOwn(easingInitials, name[0]))
				easingInitialsArr.push(name[0]);
			easingInitials[name[0]] = true;

			if (!name[1])
				throw new Error(`'${name}' is not a valid name; names must be at least two characters long`);

			if (!hasOwn(easingSecondChars, name[1]))
				easingSecondCharsArr.push(name[1]);
			easingSecondChars[name[1]] = true;
		});
	});

	easingPureNamesArr = mergesort(easingPureNamesArr);
	easingMakerNamesArr = mergesort(easingMakerNamesArr);

	// By first checking for a limited set of characters, the regex matching
	// process can be made faster simply because the engine can check for a smaller
	// set of characters before matching starts, hopefully reducing backtracking, etc
	const matchHint = `(?=[${easingInitialsArr.join("")}][${easingSecondCharsArr.join("")}])`,
		matchExpr = `${matchHint}(${easingPureNamesArr.join("|")}|(?:${easingMakerNamesArr.join("|")})\\((.+?)\\))`;

	Ease.regexes.match = new RegExp(matchExpr);
	Ease.regexes.matchStart = new RegExp(`^\\s*${matchExpr}`);
	Ease.regexes.matchEnd = new RegExp(`\\s+${matchExpr}\\s*$`);
}

(_ => {
	updateRegexes();

	Object.assign(Ease.easings.pure, {
		ease: Ease.compile("cubic-bezier(0.25, 0.1, 0.25, 1)"),
		"step-start": Ease.compile("steps(1, jump-start)"),
		"step-end": Ease.compile("steps(1, jump-end)")
	});

	updateRegexes();
})();

export default Ease;

// Visual testing
/* function drawBezier(bez, size) {
	size = size || 1000;
	const canv = document.createElement("canvas"),
		ctx = canv.getContext("2d");

	canv.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; z-index: 1000;";
	document.body.append(canv);
	canv.width = canv.height = size;
	ctx.lineWidth = 2;
	ctx.strokeStyle = "red";

	ctx.beginPath();
	ctx.moveTo(0, size);
	for (let i = 1; i <= size; i++)
		ctx.lineTo(i, size - bez(i / size) * size);
	ctx.stroke();
}

function maxDiff(bez, bez2) {
	const iter = 1e6;
	let md = 0,
		absMd = 0,
		totDiff = 0,
		incidencePos = -1;

	for (let i = 0; i <= iter; i++) {
		const diff = bez(i / iter) - bez2(i / iter),
			absDiff = Math.abs(diff);

		if (absMd < absDiff) {
			md = diff;
			absMd = absDiff;
			incidencePos = i / iter;
        }

		totDiff += absDiff;
	}

	return {
		max: md,
		avgDiff: totDiff / iter,
		incidencePos
	};
}

window.calcBezier = calcBezier;
window.drawBezier = drawBezier;*/
