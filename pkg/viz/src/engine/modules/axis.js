import {
	clone,
	hasOwn
} from "@qtxr/utils";
import { warningFlagEnabled } from "../viz-utils";

export default class Axis {
	constructor(type, owner, warnings) {
		this.tree = clone(owner.getter.get(["axes", type]));
		this.type = this.tree.name;
		this.owner = owner;
		this.warnings = warnings;
		this.init();
	}

	init() {
		function traverse(interval) {
			if (interval.type == "template")
				interval.steps = interval.get();

			interval.showMap = arrToTruthMap(interval.showMap || []);

			if (interval.subs) {
				for (let i = 0, l = interval.subs.length; i < l; i++)
					traverse(interval.subs[i]);
			}
		}

		calcKillMap(this.tree);
		traverse(this.tree);
	}

	extract(startIndex, endIndex, full) {
		// Important: for performance reasons, the args object is constantly updated on
		// a property by property basis instead of clong the object. For recursivre purposes
		// this should suffice.
		const hits = {},
			span = (Math.abs(endIndex - startIndex) / full) * 2,
			args = {
				span,
				owner: this.owner,
				warnings: this.warnings,
				i18n: this.owner.i18n
			},
			tree = this.tree,
			zoomLvl = this.tree.getZoom(span);
		let reference = {};

		// Check for infinite spans before it attempts to turn the CPU into glass
		if (!isFinite(startIndex) || !isFinite(endIndex)) {
			if (warningFlagEnabled(this.warnings, "infiniteSpan"))
				console.warn("Infinite span detected. Will refuse to paint axis.");

			return;
		}

		function collectRef(data, ref) {
			ref.markings = [];
			ref.style = {
				line: data.style.line || "col1"
			};

			if (data.subs) {
				ref.subs = [];
				for (let i = 0, l = data.subs.length; i < l; i++)
					ref.subs.push(collectRef(data.subs[i], {}));
			}

			return ref;
		}

		reference = collectRef(tree, {});

		const extr = (interval, start, end, ref) => {
			let s = 0,
				e = 0,
				canAdd = !interval.showMap || hasOwn(interval.showMap, zoomLvl);

			switch (interval.type) {
				case "template":
				case "generator": {
					const steps = interval.steps || interval.get(args, zoomLvl),
						l = steps.length;

					for (let i = 0; i < l; i++) {
						const step = steps[i];

						Object.assign(args, step.args);

						s = step.marking;
						e = (steps[i + 1] || { marking: end }).marking;

						if (e >= startIndex) {
							if (s >= endIndex || s >= end)
								break;

							if (canAdd && !hits[s] && s >= start) {
								hits[s] = true;
								ref.markings.push({
									marking: s,
									label: step.label
								});
							}

							if (!interval.killMap[zoomLvl])
								propagate(interval, s, e, ref);
						}
					}

					break;
				}

				case "implication": {
					const span = interval.getSpan ? interval.getSpan(args) : interval.span;

					start = Math.max(start, start + Math.floor((startIndex - start) / span) * span);

					const startP = interval.start || 0,
						refP = interval.position == "absolute" ? startP : (start + startP),
						from = start + (refP - start) % span - span;

					s = from;
					e = Math.min(from + span, endIndex);

					while (true) {
						if (s >= endIndex || s >= end)
							break;

						s = Math.round(s * 1e6) / 1e6;

						if (canAdd && !hits[s]) {
							hits[s] = true;
							ref.markings.push({
								marking: s,
								label: interval.get ? interval.get(s, args, zoomLvl) : s
							});
						}

						if (!interval.killMap[zoomLvl])
							propagate(interval, s, e, ref);

						s = e;
						e = s + span;
					}

					break;
				}

				default:
					if (warningFlagEnabled(this.warnings, "illegalGraduationMode"))
						console.warn(`Illegal graduation mode '${interval.type}'. Cannot continue calculating axis.`);
			}
		};

		function propagate(interval, start, end, ref) {
			if (interval.subs) {
				for (let i = 0, l = interval.subs.length; i < l; i++)
					extr(interval.subs[i], start, end, ref.subs[i]);
			}
		}

		extr(this.tree, startIndex, endIndex, reference);
		return flatten(reference);
	}
}

function flatten(ref) {
	let arr = [ref];

	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		if (item.subs) {
			for (let j = 0, l = item.subs.length; j < l; j++) {
				arr.push(item.subs[j]);
				delete item.subs;
			}
		}
	}

	return arr;
}

function calcKillMap(interval) {
	interval.killMap = arrToTruthMap(interval.showMap || []);
	const km = interval.killMap;

	if (interval.subs) {
		const s = interval.subs;

		for (let i = 0, l = s.length; i < l; i++) {
			const km2 = calcKillMap(s[i]);
			for (let k in km2) {
				if (hasOwn(km2, k))
					km[k] = false;
			}
		}
	}

	return km;
}

function arrToTruthMap(arr) {
	const out = {};

	for (let i = 0, l = arr.length; i < l; i++)
		out[arr[i]] = true;

	return out;
}
