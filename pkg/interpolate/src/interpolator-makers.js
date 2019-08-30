import Color from "@qtxr/color";
import BasicInterpolator from "./basic-interpolator";
import DiscreteInterpolator from "./discrete-interpolator";
import FunctionListInterpolator from "./function-list-interpolator";

const parserOptions = {
	parseStringKeyframes: true
};

const interpolatorMakers = {
	_numerical: {
		make(keyframes) {
			return BasicInterpolator.compile(keyframes, parserOptions).format("number");
		}
	},
	_discrete: {
		make(keyframes) {
			return DiscreteInterpolator.compile(keyframes, parserOptions);
		}
	},
	_color: {
		make(keyframes) {
			return BasicInterpolator.compile(keyframes, parserOptions).format("color");
		}
	},
	transform: {
		make(keyframes) {
			return FunctionListInterpolator.compile(keyframes, parserOptions, this.functions);
		},
		functions: {
			matrix: {
				params: 6,
				defaultUnits: "",
				defaultArgs: [0, 0, 0, 0, 0, 0]
			},
			translate: {
				params: [1, 2],
				conformArgs(args) {
					if (args.length == 1)
						return [args[0], 0];
					
					return args;
				},
				defaultUnits: "px",
				defaultArgs: [0, 0]
			},
			translateX: {
				params: 1,
				defaultUnits: "px",
				defaultArgs: 0
			},
			translateY: {
				params: 1,
				defaultUnits: "px",
				defaultArgs: 0
			},
			scale: {
				params: [1, 2],
				conformArgs(args) {
					if (args.length == 1)
						return [args[0], args[0]];

					return args;
				},
				defaultUnits: "",
				defaultArgs: [0, 0]
			},
			scaleX: {
				params: 1,
				defaultUnits: "",
				defaultArgs: 0
			},
			scaleY: {
				params: 1,
				defaultUnits: "",
				defaultArgs: 0
			},
			skew: {
				params: [1, 2],
				conformArgs(args) {
					if (args.length == 1)
						return [args[0], 0];
					
					return args;
				},
				defaultUnits: "deg",
				defaultArgs: [0, 0]
			},
			skewX: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			skewY: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			matrix3d: {
				params: [1, 16],
				defaultUnits: "",
				defaultArgs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
			},
			translate3d: {
				params: 3,
				defaultUnits: "px",
				defaultArgs: [0, 0, 0]
			},
			translateZ: {
				params: 1,
				defaultUnits: "px",
				defaultArgs: 0
			},
			scale3d: {
				params: 3,
				defaultUnits: "",
				defaultArgs: [0, 0, 0]
			},
			scaleZ: {
				params: 1,
				defaultUnits: "",
				defaultArgs: 0
			},
			rotate3d: {
				params: 4,
				defaultUnits: ["", "", "", "deg"],
				defaultArgs: [0, 0, 0, 0]
			},
			rotate: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			rotateX: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			rotateY: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			rotateZ: {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			perspective: {
				params: 1,
				defaultUnits: "px",
				defaultArgs: 0
			}
		}
	},
	filter: {
		make(keyframes) {
			return FunctionListInterpolator.compile(keyframes, parserOptions, this.functions);
		},
		functions: {
			blur: {
				params: 1,
				defaultUnits: "px",
				defaultArgs: 0
			},
			brightness: {
				params: 1,
				defaultUnits: "",
				defaultArgs: 0
			},
			contrast: {
				params: [1],
				defaultUnits: "%",
				defaultArgs: 0
			},
			"drop-shadow": {
				params(args) {
					let profile = "";

					for (let i = 0, l = args.length; i < l; i++) {
						const ex = this.argRegex.exec(args[i]);
						if (!ex)
							return false;

						profile += (ex[3] ? "c" : "v");		// c: color, v: value
					}

					if (profile.length < 3 || profile.length > 4)
						return false;

					if (profile[profile.length - 1] != "c")
						return false;

					if (profile.replace(/v/g, "") != "c")
						return false;

					return true;
				},
				conformArgs(args) {
					if (args.length == 3)
						args.splice(2, 0, 0);
					
					return args;
				},
				paramDelimiter: "space",
				argRegex: /([\d.e-]*[\d])\s*([\w%]*)|(^.+?$)/,
				parseArg(arg, idx, ex) {
					if (ex[3]) {
						return {
							value: new Color(ex[3]),
							unit: ""
						};
					} else {
						return {
							value: Number(ex[1]),
							unit: ex[2]
						};
					}
				},
				defaultUnits: [0, 0, 0, ""],
				defaultArgs: [0, 0, 0, "black"]
			},
			grayscale: {
				params: 1,
				defaultUnits: "%",
				defaultArgs: 0
			},
			"hue-rotate": {
				params: 1,
				defaultUnits: "deg",
				defaultArgs: 0
			},
			invert: {
				params: 1,
				defaultUnits: "%",
				defaultArgs: 0
			},
			saturate: {
				params: 1,
				defaultUnits: "%",
				defaultArgs: 0
			},
			sepia: {
				params: 1,
				defaultUnits: "%",
				defaultArgs: 0
			}
		}
	},
	opacity: "_numerical",
	color: "_color",
	stroke: "_color",
	fill: "_color",
	"stroke-width": "_numerical",
	"background-color": "_color"
};

function resolveInterpolatorMaker(property) {
	if (!interpolatorMakers.hasOwnProperty(property))
		return interpolatorMakers._discrete;

	if (typeof interpolatorMakers[property] == "string")
		return resolveInterpolatorMaker(interpolatorMakers[property]);

	return interpolatorMakers[property];
}

export default interpolatorMakers;

export {
	resolveInterpolatorMaker
};
