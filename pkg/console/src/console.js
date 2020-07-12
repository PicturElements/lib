import Interceptor from "./intercept";
import { el } from "./utils";
import panel from "./templates/panel";
import {
	hasOwn,
	serialize
} from "@qtxr/utils";

let wrapper = null;

export default class Console {
	constructor(config = {}) {
		this.config = config;
		this.nodes = {};
		this.messages = [];
		this.counts = {
			errors: 0,
			warnings: 0,
			logs: 0
		};
		this.interceptor = config.interceptor || new Interceptor();
		this.interceptor.hook("intercept", (interceptor, args, meta) => {
			this.handleIntercept(args, meta);
		});
		this.mount();
	}

	// Setup and routing
	mount() {
		if (!wrapper) {
			const wrapperPrecursor = el`.panel-wrapper`;

			if ("attachShadow" in wrapperPrecursor)
				wrapper = wrapperPrecursor.attachShadow({ mode: "open" });
			else
				wrapper = wrapperPrecursor;

			document.documentElement.appendChild(wrapperPrecursor);
			wrapper.appendChild(el`style .panel { position: fixed; top: 60%; left: 0; bottom: 0; right: 0; color: #4e565a; background: whitesmoke; transition: transform 400ms; font-family: Courier New, Arial, sans-serif; } .panel.collapsed { transform: translateY(100%); } .panel.collapsed .header-button.expando { transform: scaleY(-1); } .panel .panel-header { position: absolute; display: flex; justify-content: space-between; bottom: 100%; left: 0; width: 100%; height: 30px; background: white; border: 1px solid #dde3e8; border-left: none; border-right: none; } .panel .header-button { position: relative; width: 30px; height: 30px; padding: 0; border: none; outline: none; box-sizing: content-box; background: transparent; cursor: pointer; } .panel .header-button svg { display: block; position: absolute; top: 0; width: 0; left: 0; right: 0; width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 0.8; stroke-linecap: round; stroke-linejoin: round; } .panel .panel-header-left .header-button { border-right: 1px solid #dde3e8; } .panel .stats { display: flex; height: 100%; padding-left: 5px; border-left: 1px solid #dde3e8; } .panel .stats .stat { display: flex; align-items: center; margin: 5px 5px 5px 0; padding: 0 8px; text-align: center; border-radius: 3px; border: 1px solid rgba(0, 0, 0, 0.1); font-size: 90%; } .panel .stats .stat:after { content: attr(data-count); color: white; font-weight: bold; } .panel .stats .stat.errors { background: #ef390d; } .panel .stats .stat.warnings { background: #ef8c0b; } .panel .stats .stat.logs { background: #859cab; } .panel .panel-content { height: 100%; overflow: auto; } .panel .message { display: flex; padding: 5px 8px; line-height: 1; white-space: pre-wrap; border-bottom: 1px solid; } .panel .message.log { background: rgba(207, 213, 228, 0.3); border-color: rgba(207, 213, 228, 0.3); } .panel .message.info { background: rgba(64, 146, 234, 0.25); border-color: rgba(64, 146, 234, 0.25); color: #07468c; } .panel .message.warning { background: rgba(255, 206, 16, 0.2); border-color: rgba(255, 206, 16, 0.2); color: #803906; } .panel .message.error { background: rgba(255, 1, 45, 0.15); border-color: rgba(255, 1, 45, 0.15); color: #a00940; } .panel .message.error .error-header { font-size: 90%; font-weight: bold; margin-bottom: 5px; } .panel .message.error .error-content { overflow: auto; } .panel .message .message-content { flex-grow: 1; overflow: hidden; } .panel .message .message-meta { font-size: 80%; margin-left: 10px; } .panel .message .message-meta .time { font-weight: bold; } @media (max-aspect-ratio: 1 / 1) and (max-width: 700px) { .panel .header-button { padding: 0 10px; } .panel .message-meta { display: none; } }`);
		}

		const pnl = panel();
		wrapper.appendChild(pnl);

		const n = {
			panel: pnl,
			content: pnl.querySelector(".panel-content"),
			buttons: {
				expando: pnl.querySelector(".header-button.expando"),
				clear: pnl.querySelector(".header-button.clear")
			},
			stats: {
				errors: pnl.querySelector(".stat.errors"),
				warnings: pnl.querySelector(".stat.warnings"),
				logs: pnl.querySelector(".stat.logs")
			}
		};

		pnl.classList.toggle("collapsed", Boolean(this.config.collapsed));
		n.buttons.expando.onclick = _ => pnl.classList.toggle("collapsed");
		n.buttons.clear.onclick = _ => this.clear();

		this.nodes = n;
	}

	handleIntercept(args, meta) {
		switch (meta.path) {
			case "console.log":
				this.log(...args);
				break;

			case "console.info":
				this.info(...args);
				break;

			case "console.warn":
				this.warn(...args);
				break;

			case "console.error":
				this.error(...args);
				break;

			case "console.clear":
				this.clear(...args);
				break;

			case "Error": {
				const content = el`
					.error-header ${args[0].filename}:${args[0].lineno}
					.error-content
				`;

				content.querySelector(".error-content").textContent = args[0].error.stack;

				this.putMessage("error", content);
				this.updateCount("errors");
				break;
			}
		}
	}

	// Handlers
	log(...args) {
		this.putMessage("log", srz(args));
		this.updateCount("logs");
	}

	info(...args) {
		this.putMessage("info", srz(args));
		this.updateCount("logs");
	}

	warn(...args) {
		this.putMessage("warning", srz(args));
		this.updateCount("warnings");
	}

	error(...args) {
		this.putMessage("error", srz(args));
		this.updateCount("errors");
	}

	clear() {
		for (const k in this.counts) {
			if (hasOwn(this.counts, k)) {
				this.counts[k] = 0;
				this.nodes.stats[k].dataset.count = 0;
			}
		}

		this.nodes.content.innerHTML = "";
	}

	// Utils
	putMessage(type, content) {
		const d = new Date();
		const message = el`
			.message.${type}
				.message-content
				.message-meta
					span.date ${d.toDateString()}
					|
					span.time ${d.toLocaleTimeString()}
		`;

		if (content instanceof Node)
			message.querySelector(".message-content").appendChild(content);
		else
			message.querySelector(".message-content").textContent = content;

		this.nodes.content.appendChild(message);
		this.nodes.content.scrollTop = 1e5;
	}

	updateCount(key) {
		this.counts[key]++;
		this.nodes.stats[key].dataset.count = this.counts[key];
	}

	// Destructor
	destroy() {
		this.interceptor.destroy();
	}
}

function srz(args) {
	return args
		.map(a => serialize(a, {
			bareString: true
		}))
		.join("\n");
}
