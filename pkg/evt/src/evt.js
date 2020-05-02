import {
	clone,
	hasOwn,
	getConstructorName
} from "@qtxr/utils";

const KEY_CODE_MAP = {
		8: "backspace",
		13: "enter",
		16: "shift",
		17: "control",
		18: "alt",
		20: "capslock",
		27: "escape",
		32: "space",
		35: "end",
		36: "home",
		37: "left",
		38: "up",
		39: "right",
		40: "down",
		46: "delete"
	},
	CONVERT_MAP = {
		esc: "escape",
		spacebar: "space",
		" ": "space",
		arrowleft: "left",
		arrowright: "right",
		arrowup: "up",
		arrowdown: "down",
		metaleft: "meta",
		metaright: "meta",
		controlleft: "control",
		controlright: "control",
		shiftleft: "shift",
		shiftright: "shift"
	},
	KEY_TESTS = {
		ctrl: /c(on)?tro?l\+/gi,
		alt: /alt\+/gi,
		shift: /shift\+/gi,
		meta: /cmd\+/gi
	},
	KEY_ALIASES = [
		["ctrl", "ctrlKey"],
		["alt", "altKey"],
		["shift", "shiftKey"],
		["meta", "metaKey"]
	];

const EVT = {
	is(evt) {
		const name = getConstructorName(evt);

		switch (name) {
			case "KeyboardEvent":
				return isHotkeyMulti.apply(this, arguments);
		}
		return false;
	},

	getKey(evt, bare) {
		const name = getConstructorName(evt);

		switch (name) {
			case "KeyboardEvent":
				return getKey(evt, bare);
		}

		return null;
	},

	getCoords(evt, elem) {
		// internalCoordData is used because touchend doesn't provide coordinates
		// for touch points whereas mouseup does and consistency is needed
		// Alternatively, if the event is the same as the one already logged, just return the
		// calculated value
		let point = null;

		if (this.internalCoordData.evt == evt || (evt.touches && !("clientX" in evt) && evt.touches.length == 0))
			point = clone(this.internalCoordData.point);
		else {
			const e = (evt.touches || [evt])[0];
			point = {
				x: e.clientX,
				y: e.clientY,
				xRaw: e.clientX,
				yRaw: e.clientY
			};
		}

		if (elem) {
			const bcr = elem.getBoundingClientRect();
			point.x = point.xRaw - bcr.left;
			point.y = point.yRaw - bcr.top;
		}

		this.internalCoordData = {
			point: point,
			evt: evt
		};

		return point;
	},

	addEvt(elem, name, handler) {
		elem.removeEventListener(name, handler);
		elem.addEventListener(name, handler);
	},

	internalCoordData: {
		point: {
			x: -100,
			y: -100,
			xRaw: -100,
			yRaw: -100
		},
		evt: null
	}
};

function isKey(evt, key, keys, bare = false) {
	keys = keys || {};

	for (let i = 0, l = KEY_ALIASES.length; i < l; i++) {
		const [alias, origKey] = KEY_ALIASES[i];

		if (!evt[origKey] && keys[alias])
			return false;
	}

	key = key.toLowerCase();
	return getKey(evt, bare) === key;
}

function getKey(evt, bare = false) {
	// Return the bare key
	if (bare === true && evt.code) {
		const code = evt.code.toLowerCase();
		let key = code;

		if (code.indexOf("key") == 0)
			key = code.substring(3);
		else if (code.indexOf("digit") == 0)
			key = code.substring(5);

		return coerceKeyName(key);
	}

	if (evt.key)
		return coerceKeyName(evt.key.toLowerCase());

	const kc = getKeyCode(evt),
		kMap = KEY_CODE_MAP[kc];

	if (kMap)
		return kMap;

	if (kc >= 65 && kc <= 90)
		return String.fromCharCode(kc + 32);
	if (kc >= 48 && kc <= 57)
		return String.fromCharCode(kc);

	return null;
}

function coerceKeyName(key) {
	if (hasOwn(CONVERT_MAP, key))
		return CONVERT_MAP[key];
	return key;
}

function getKeyCode(evt) {
	return evt.which || evt.keyCode || evt.charCode || 0;
}

function isHotkeyMulti(evt, first, ...rest) {
	if (!isHotkey(evt, first, true))
		return false;

	for (let i = 0, l = rest.length; i < l; i++) {
		if (isHotkey(evt, rest[i], true))
			return true;
	}

	return true;
}

const modifierKeys = {
	alt: true,
	shift: true
};

function isHotkey(evt, key, enforceModifierKey) {
	const keys = {
		ctrl: false,
		alt: false,
		shift: false,
		meta: false
	};
	let bare = false;

	for (const k in KEY_TESTS) {
		if (hasOwn(KEY_TESTS, k) && KEY_TESTS[k].test(key)) {
			keys[k] = true;
			key = key.replace(KEY_TESTS[k], "");
			bare = (!!enforceModifierKey) && hasOwn(modifierKeys, k);
		}
	}

	return isKey(evt, key, keys, bare);
}

export default EVT;
