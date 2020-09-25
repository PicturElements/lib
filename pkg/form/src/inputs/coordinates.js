import {
	round,
	hasOwn,
	isObject,
	reassign
} from "@qtxr/utils";
import Input, { INJECT } from "./input";

export default class Coordinates extends Input {
	constructor(name, options, form) {
		super(name, options, form, {
			mapOptions: Object,
			markerOptions: Object,
			noSearch: "boolean",
			noGeolocation: "boolean",
			noCoords: "boolean"
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
		.as("string")
		.to(d => {
			const coordData = parseCoordinate(d);
			return {
				lat: coordData.lat.dd,
				lng: coordData.lng.dd
			};
		})
		.from((d, f) => {
			const source = typeof f.sourceData == "string" ?
					f.sourceData :
					"0°0'0\" N, 0°0'0\" E",
				coordData = parseCoordinate(source);

			coordData.lat.dd = (d && d.lat) || 0;
			coordData.lng.dd = (d && d.lng) || 0;
			return constructCoordinateStr(coordData);
		})
	.if(Object)
		.as("object")
		.to(d => {
			return {
				lat: d.lat || d.latitude || 0,
				lng: d.lng || d.long || d.longitude || 0
			};
		})
		.from((d, f) => {
			return reassign(
				{},
				(d || { lat: 0, lng: 0 }),
				(isObject(f.sourceData) ? f.sourceData : { lat: 0, lng: 0 }),
				{
					lat: ["lat", "latitude"],
					lng: ["lng", "long", "longitude"]
				}
			);
		})
	.if(Array)
		.as("array")
		.to(d => ({
			lat: d[0] || 0,
			lng: d[1] || 0
		}))
		.from(d => [
			(d && d.lat) || 0,
			(d && d.lng) || 0
		]);

// Precision based on this scientific publication:
// https://imgs.xkcd.com/comics/coordinate_precision.png
// or this
// https://en.wikipedia.org/wiki/Decimal_degrees#Precision
const PRECISION = 5;
const coordinateRegex = /(,?\s*([NEWS])?\s*)(-?[\d.]+)(°?\s*)(?:(-?[\d.]+)([′']\s*|\s+|$|(?=[NEWS])))?(?:(-?[\d.]+)([″”"]\s*|\s+|$|(?=[NEWS])))?([NEWS])?/gi,
	kvCoordinateRegex = /^(\s*)(-?[\d]*(?:\.[\d]*)?)(?:(\s+)(-?[\d]*(?:\.[\d]*)?))?\s*$/,
	latLngMap = {
		N: ["lat", 1],
		E: ["lng", 1],
		W: ["lng", -1],
		S: ["lat", -1]
	},
	latLngIndexOrder = ["N", "E"];

function parseCoordinate(str) {
	const coordData = {
		lat: {
			name: "lat",
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
			name: "lng",
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
		order: [null, null]
	};

	const kvEx = kvCoordinateRegex.exec(str);

	if (kvEx) {
		const coords = [coordData.lat, coordData.lng];

		for (let i = 0, l = coords.length; i < l; i++) {
			if (!kvEx[2 + i * 2])
				continue;

			const d = coords[i],
				coord = Number(kvEx[2 + i * 2]);

			d.dd = coord;
			d.degrees = coord;
			d.degreeInfix = "";
			d.prefix = kvEx[1 + i * 2];
			coordData.order[i] = d.name;
		}

		return coordData;
	}

	let idx = 0;

	while (true) {
		const ex = coordinateRegex.exec(str);
		if (!ex)
			break;

		const [
			_,
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

		const direction = prefixId || postfixId || latLngIndexOrder[idx];

		if (prefixId && postfixId)
			coordinateRegex.lastIndex--;

		if (!hasOwn(latLngMap, direction))
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

		coordData.order[idx] = axis;
		coordData[axis] = d;
		idx++;
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
			round(d.dd * d.sgn, PRECISION) :
			degrees;
		out += d.degreeInfix;

		if (minutes != null) {
			out += (seconds == null ?
				round(minutes, Math.max(PRECISION - 1, 0)) :
				Math.floor(minutes));
			out += d.minuteInfix;
		}

		if (seconds != null)
			out += (round(seconds, Math.max(PRECISION - 3, 0)) + d.secondInfix);

		return out + d.postfixId;
	};

	let outStr = "";

	for (let i = 0, l = coordData.order.length; i < l; i++) {
		const key = coordData.order[i];

		if (typeof key == "string")
			outStr += constr(coordData[key]);
	}

	return outStr;
}
