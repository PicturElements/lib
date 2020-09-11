import {
	alias,
	mkPath,
	isObjectLike
} from "@qtxr/utils";
import { Hookable } from "@qtxr/bc";
import IETF from "./ietf";

export default class I18NBranch extends Hookable {
	constructor(manager, parent, path) {
		if (!isObjectLike(parent)) {
			path = parent;
			parent = null;
		}

		super();

		this.manager = manager;
		this.parent = parent || manager;

		if (parent && parent.path)
			this.path = mkPath(parent.path, path || "");
		else
			this.path = path || "";

		this.requestedLocale = this.parent.locale;
		this.ownLocale = null;

		this.parent.hook({
			name: "*",
			argTemplate: "context",
			handler: (ctx, ...args) => this.callHooks(ctx.key, ...args)
		});
	}

	get locale() {
		return this.ownLocale || this.parent.locale;
	}

	set locale(locale) {
		this.setLocale(locale);
	}

	// Retrieval
	get(accessor, locale = null, copy = false) {
		return this.manager.get(
			this.mkPath(accessor),
			locale || this.locale,
			copy
		);
	}

	getOr(accessor, locale = null, copy = false) {
		return (fallback = null) => {
			return this.manager.getOr(
				this.mkPath(accessor),
				locale || this.locale,
				copy
			)(fallback);
		};
	}

	getOfType(accessor, type, locale = null, copy = false) {
		return (fallback = null) => {
			return this.manager.getOfType(
				this.mkPath(accessor),
				type,
				locale || this.locale,
				copy
			)(fallback);
		};
	}

	format(format, vars = null, locale = null, baseStore = {}, overloads = null) {
		return this.manager._format(
			this.path,
			format,
			vars,
			locale || this.locale,
			baseStore,
			overloads
		);
	}

	dateFormat(format, vars = null, date = null, locale = null, overloads = null) {
		return this.manager._dateFormat(
			this.path,
			format,
			vars,
			date,
			locale || this.locale,
			overloads
		);
	}

	interpolate(accessor, ...args) {
		return this.manager.interpolate(
			this.mkPath(accessor),
			...args
		);
	}

	getPartition(locale) {
		return this.manager.getPartition(locale);
	}

	// Fetching
	setLocale(locale, config = null, lazy = true) {
		if (locale == null) {
			const oldLocale = this.ownLocale;
			this.ownLocale = null;

			this.callHooks("localeset", null);

			if (oldLocale != null)
				this.callHooks("localechange", null, oldLocale);

			return Promise.resolve(true);
		}

		locale = IETF.coerce(locale);
		this.requestedLocale = locale;

		return this.manager.loadLocale(locale, config, lazy)
			.then(success => {
				const oldLocale = this.ownLocale;

				if (!success)
					return false;

				this.ownLocale = locale;
				this.callHooks("localeset", locale);

				if (!locale.equals(oldLocale))
					this.callHooks("localechange", locale, oldLocale);

				return true;
			});
	}

	feed(payload, force = false) {
		payload = Object.assign({}, payload);

		if (!payload.path)
			payload.path = this.path;
		else
			payload.path = this.mkPath(payload.path);

		return this.manager.feed(payload, force);
	}

	// Branching
	branch(path = "") {
		return new I18NBranch(this.manager, this, path);
	}

	// Utils
	mkPath(accessor) {
		return mkPath(
			this.path,
			accessor == null ? "" : accessor
		);
	}
}

alias(I18NBranch.prototype, {
	format: ["fmt", "compose"],
	dateFormat: ["dfmt", "dateCompose"]
});
