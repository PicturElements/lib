import {
	round,
	reassign
} from "@qtxr/utils";
import BaseInput, { INJECT } from "@qtxr/form/src/inputs/base-input";

export default class Coordinates extends BaseInput {
	constructor(name, options, form) {
		super(name, options, form, {
			mapOptions: Object,
			markerOptions: Object
		});
	}
	
	[INJECT](value) {
		value = typeof this.handlers.inject == "function" ?
			super[INJECT](value) :
			value;

		return this.vt(value);
	}
}

Coordinates.formalize
	.if("string")
		.to(d => {
			const coordData = parseCoordinate(d);
			return {
				lat: coordData.lat.dd,
				lng: coordData.lng.dd
			};
		})
		.from((d, f) => {
			const coordData = parseCoordinate(f.sourceData);
			coordData.lat.dd = d.lat;
			coordData.lng.dd = d.lng;
			return constructCoordinateStr(coordData);
		})
	.if(Object)
		.to(d => {
			return {
				lat: d.lat || d.latitude || 0,
				lng: d.lng || d.long || d.longitude || 0
			};
		})
		.from((d, f) => {
			return reassign({}, d, f.sourceData, {
				lat: ["lat", "latitude"],
				lng: ["lng", "long", "longitude"]
			});
		})
	.if(Array)
		.to(d => ({
			lat: d[0] || 0,
			lng: d[1] || 0
		}))
		.from(d => [d.lat, d.lng]);

// Precision based on this scientific publication:
// https://imgs.xkcd.com/comics/coordinate_precision.png
const PRECISION = 5;
const coordinateRegex = /(\s*([NEWS])?\s*)(-?[\d.]+)(°?\s*)(?:(-?[\d.]+)('\s*|\s+|$|(?=[NEWS])))?(?:(-?[\d.]+)([”"]\s*|\s+|$|(?=[NEWS])))?([NEWS])?/gi,
	latLngMap = {
		N: ["lat", 1],
		E: ["lng", 1],
		W: ["lng", -1],
		S: ["lat", -1]
	};

function parseCoordinate(str) {
	const coordData = {
		lat: {
			dd: 0,
			degrees: 0,
			degreeInfix: null,
			minutes: null,
			minuteInfix: null,
			seconds: null,
			secondInfix: null,
			prefix: "",
			prefixId: "",
			postfixId: "",
			sgn: 1
		},
		lng: {
			dd: 0,
			degrees: 0,
			degreeInfix: null,
			minutes: null,
			minuteInfix: null,
			seconds: null,
			secondInfix: null,
			prefix: "",
			prefixId: "",
			postfixId: "",
			sgn: 1
		}
	};

	while (true) {
		const ex = coordinateRegex.exec(str);
		if (!ex)
			break;

		const [
			match,
			prefix,
			prefixId,
			degrees,
			degreeInfix,
			minutes,
			minuteInfix,
			seconds,
			secondInfix,
			postfixId
		] = ex;

		const direction = prefixId || postfixId;

		if (prefixId && postfixId)
			coordinateRegex.lastIndex--;

		console.log(direction);

		if (!latLngMap.hasOwnProperty(direction))
			continue;

		const [
			axis,
			masterSgn
		] = latLngMap[direction];

		const d = {
			dd: 0,
			degrees: Number(degrees) || 0,
			degreeInfix,
			minutes: minutes ? Number(minutes) || 0 : null,
			minuteInfix,
			seconds: seconds ? Number(seconds) || 0 : null,
			secondInfix,
			prefix,
			prefixId: prefixId || "",
			postfixId: prefixId ? "" : (postfixId || ""),
			sgn: masterSgn
		};

		const sgn = d.degrees >= 0 ? 1 : -1;
		d.dd = ((d.degrees / sgn) + (d.minutes || 0) / 60 + (d.seconds || 0) / 3600) * sgn * masterSgn;

		coordData[axis] = d;
	}

	return coordData;
}

function constructCoordinateStr(coordData) {
	const constr = d => {
		let out = d.prefix,
			degrees = ~~(d.dd * d.sgn),	// Round towards 0
			minutes = d.minutes == null ?
				null :
				Math.abs(d.dd % 1) * 60,
			seconds = d.seconds == null ?
				null :
				((Math.abs(d.dd) - Math.floor(minutes || 0) / 60) % 1) * 3600;

		out += (minutes == null && seconds == null) ?
			round(d.dd, PRECISION) :
			degrees;
		out += d.degreeInfix;

		if (minutes != null) {
			out += (seconds == null ?
				round(minutes, PRECISION) :
				Math.floor(minutes));
			out += d.minuteInfix;
		}

		if (seconds != null)
			out += (round(seconds, PRECISION) + d.secondInfix);
		
		return out + d.postfixId;
	};

	return constr(coordData.lat) + constr(coordData.lng);
}
