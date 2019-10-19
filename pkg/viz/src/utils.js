import {
	clone,
	forEach,
	findClosest,
	isNativeSimpleObject
} from "@qtxr/utils";

const DOM_NAMESPACES = [
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter(t) { return t; },
		tags: { altGlyph: 1, altGlyphDef: 1, altGlyphItem: 1, animate: 1, animateColor: 1, animateMotion: 1, animateTransform: 1, circle: 1, clipPath: 1, "color-profile": 1, cursor: 1, defs: 1, desc: 1, discard: 1, ellipse: 1, feBlend: 1, feColorMatrix: 1, feComponentTransfer: 1, feComposite: 1, feConvolveMatrix: 1, feDiffuseLighting: 1, feDisplacementMap: 1, feDistantLight: 1, feDropShadow: 1, feFlood: 1, feFuncA: 1, feFuncB: 1, feFuncG: 1, feFuncR: 1, feGaussianBlur: 1, feImage: 1, feMerge: 1, feMergeNode: 1, feMorphology: 1, feOffset: 1, fePointLight: 1, feSpecularLighting: 1, feSpotLight: 1, feTile: 1, feTurbulence: 1, filter: 1, "font-face": 1, "font-face-format": 1, "font-face-name": 1, "font-face-src": 1, "font-face-uri": 1, foreignObject: 1, g: 1, glyph: 1, glyphRef: 1, hatch: 1, hatchpath: 1, hkern: 1, image: 1, line: 1, linearGradient: 1, marker: 1, mask: 1, mesh: 1, meshgradient: 1, meshpatch: 1, meshrow: 1, metadata: 1, "missing-glyph": 1, mpath: 1, path: 1, pattern: 1, polygon: 1, polyline: 1, radialGradient: 1, rect: 1, set: 1, solidcolor: 1, stop: 1, svg: 1, switch: 1, symbol: 1, text: 1, textPath: 1, tref: 1, tspan: 1, unknown: 1, use: 1, view: 1, vkern: 1 }
	},
	{
		uri: "http://www.w3.org/2000/svg",
		tagGetter(t) { return t.replace("svg-", ""); },
		tags: { "svg-a": 1, "svg-font": 1, "svg-script": 1, "svg-style": 1, "svg-title": 1 }
	}
],
	NS_LEN = DOM_NAMESPACES.length;

let blankDiv = null;

// blankDiv is needed to decode HTML entities.
// innerHTML is written to it, and innerText is read from it.
// This is an entire read-write cycle, which has significant performance
// implications in the order of 20x+ slowdown over document.createTextNode.
// This implementation's perks are minimal code size and industry standard
// decoding while being generally robust. Text node creation should be kept at
// a minimum at any rate.

function node(tag, cls, inner, attrs, ns) {
	let n = null;

	if (tag) {
		attrs = attrs || {};

		if (!ns) {
			ns = "http://www.w3.org/1999/xhtml";

			for (let i = 0; i < NS_LEN; i++) {
				let nsi = DOM_NAMESPACES[i];

				if (nsi.tags[tag] && nsi.tags.hasOwnProperty(tag)) {
					tag = nsi.tagGetter(tag);
					ns = nsi.uri;
					break;
				}
			}
		}

		n = document.createElementNS(ns, tag);

		if (Array.isArray(cls))
			n.setAttribute("class", cls.join(" "));
		else if (cls && typeof cls == "string")
			n.setAttribute("class", cls);

		for (let k in attrs) {
			if (attrs.hasOwnProperty(k)) {
				switch (k) {
					case "style":
						n.setAttribute("style", createStyleStr(attrs[k]));
						break;
					case "data":
						forEach(attrs[k], (v, k) => n.dataset[k] = v);
						break;
					default:
						n.setAttribute(k, attrs[k]);
				}
			}
		}

		if (inner != null) {
			inner = Array.isArray(inner) ? inner : [inner];
			for (let i = 0, l = inner.length; i < l; i++) {
				if (inner[i] instanceof Element)
					n.appendChild(inner[i]);
				else {
					blankDiv.innerHTML = inner[i];
					n.appendChild(document.createTextNode(blankDiv.innerText));
				}
			}
		}
	} else {
		blankDiv.innerHTML = cls;
		n = document.createTextNode(blankDiv.innerText);
	}

	n.app = par => {
		if (!(par instanceof Node)) {
			console.warn("node: Failed to append node.");
			return n;
		}

		par.appendChild(n);
		return n;
	};

	return n;
}

const propToAttrRegex = /([a-z])([A-Z])/g;

function createStyleStr(style) {
	if (typeof style != "object" || style == null)
		return style || "";

	let out = "";
	for (let k in style) {
		if (style.hasOwnProperty(k))
			out += (k.replace(propToAttrRegex, "$1-$2").toLowerCase() + ": " + style[k] + "; ");
	}

	return out;
}

node.body = document.body;
node.doc = document.documentElement;
node.head = document.head;

blankDiv = node("div");

function getClosestIndex(arr, target, key, options) {
	return findClosest(arr, v => v[key] - target, options).index;
}

function multiMinMax(arr, start, end) {
	const keys = [].slice.call(arguments, 1);

	for (let i = 0; i < 2; i++) {
		if (typeof keys[0] != "number") {
			if (i)
				end = arr.length;
			else
				start = 0;
		}
		if (typeof keys[0] != "string")
			keys.shift();
	}

	if (start > end) {
		end = start + end;
		start = end - start;
		end = end - start;
	}

	return minMaxHelper.apply(null, [arr, start, end, keys].concat(keys));
}

function minMaxHelper(arr, start, end, keys, a, b, c, d) {
	let min = Infinity,
		max = -Infinity;
	const kLen = keys.length;

	if (end - start < 2)
		end = start;

	switch (kLen) {
		case 1:
			for (let i = start; i <= end; i++) {
				const e = arr[i];
				min = Math.min(min, e[a]);
				max = Math.max(max, e[a]);
			}
			break;

		case 2:
			for (let i = start; i <= end; i++) {
				const e = arr[i];
				min = Math.min(min, e[a], e[b]);
				max = Math.max(max, e[a], e[b]);
			}
			break;

		case 3:
			for (let i = start; i <= end; i++) {
				const e = arr[i];
				min = Math.min(min, e[a], e[b], e[c]);
				max = Math.max(max, e[a], e[b], e[c]);
			}
			break;

		case 4:
			for (let i = start; i <= end; i++) {
				const e = arr[i];
				min = Math.min(min, e[a], e[b], e[c], e[d]);
				max = Math.max(max, e[a], e[b], e[c], e[d]);
			}
			break;

		default:
			for (let i = start; i <= end; i++) {
				const e = arr[i],
					vals = keys.map(k => e[k]);
				vals[kLen] = min;
				min = Math.min.apply(null, vals);
				vals[kLen] = max;
				max = Math.max.apply(null, vals);
			}
	}

	return {
		min: min,
		max: max
	};
}

// fillInData takes a target object and a reference object. It then goes through both of them in parallel and
// fills in any missing properties in the target object from the reference object, or only updates the existing
// properties, depending on control booleans optionally bundled with the reference object.

// fillRecessive: This property defines that the following code should only copy over properties
// in from the reference object to the target object if these are present in both objects.
// By default, the code will just complement assumed missing data in the target object from the reference.

// fillDominant: This property says that its parent object should always be copied over. It will always
// override fillRecessive if present on the parent parent object.
function fillInData(target, reference, forceFill) {
	target = clone(target);
	reference = clone(reference);

	function fill(targ, ref) {
		for (let k in ref) {
			const matching = ref.hasOwnProperty(k) && targ.hasOwnProperty(k);
			let recessive = !!ref.fillRecessive;

			if (ref[k] && ref[k].fillDominant)
				recessive = false;

			if (ref.hasOwnProperty(k) && !recessive || matching || forceFill) {
				const tk = targ[k],
					rk = ref[k];

				if (isNativeSimpleObject(tk))
					fill(tk, rk);
				else if (k != "fillRecessive" && k != "fillDominant") {
					if (!targ.hasOwnProperty(k))
						targ[k] = rk;
					// If the property is true and the reference property is an object,
					// also fill in with the reference's data
					else if (tk === true && typeof rk == "object" && rk != null) {
						targ[k] = {};
						fill(targ[k], rk);
					}
				}
			}
		}
	}

	fill(target, reference);

	return target;
}

function mapClone(target, source, map) {
	if (!source || !target)
		return target;

	if (!map) {
		Object.assign(target, source);
		return target;
	}

	for (let k in source) {
		if (source.hasOwnProperty(k)) {
			const srcIsSimple = isNativeSimpleObject(source[k]);

			if (!map[k] && !target.hasOwnProperty(k))
				target[k] = source[k];
			else if (map === true)
				target[k] = clone(source[k]);
			else {
				if (!target.hasOwnProperty(k) && srcIsSimple)
					target[k] = source[k].constructor();

				mapClone(target[k], source[k], map[k]);
			}
		}
	}

	return target;
}

export {
	node,
	getClosestIndex,
	multiMinMax,
	fillInData,
	mapClone
};
