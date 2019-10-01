// TODO:
// clean up options in handler calls (add runtime, etc)
// check nested Commanders for duplicate commands/aliases

const {
	error,
	success,
	joinDir,
	info
} = require("./utils");
const parseCLIInput = require("./parse-cli-input");

const HANDLER_DIR = "cli/handlers";
const validCommandRegex = /^[a-z0-9-_?]+$/i;

class Commander {
	constructor(config = {}) {
		applyConfigAndHooks(this, config);

		this.commandsList = [];
		this.aliases = {};
		this.commands = {};
		this.owner = null;
	}

	cmd(command, config) {
		if (!command || typeof command != "string" || !validCommandRegex.test(command))
			throw new TypeError(`Cannot add command: command must be a string with no spaces (matching ${validCommandRegex.toString()})`);
		if (this.commands.hasOwnProperty(command))
			throw new Error(`Cannot add command: duplicate command '${command}'`);
		if (this.aliases.hasOwnProperty(command))
			throw new Error(`Cannot add command: alias by name '${command}' already exists`);

		if (typeof config == "string") {
			config = {
				handle: joinDir(HANDLER_DIR, config)
			};
		} else if (!config) {
			config = {
				handle: joinDir(HANDLER_DIR, command)
			};
		} else if (isHandler(config)) {
			config = {
				handle: config
			};
		}

		if (config.handle instanceof Commander)
			config.handle.owner = this;

		const cmd = new Command(this, command, config);
		this.commandsList.push(cmd);
		this.commands[command] = cmd;

		return this;
	}

	alias(alias, targetCommand) {
		if (!alias || typeof alias != "string" || !validCommandRegex.test(alias))
			throw new TypeError(`Cannot alias: alias must be a string with no spaces (matching ${validCommandRegex.toString()})`);
		if (this.aliases.hasOwnProperty(alias))
			throw new Error(`Cannot alias: duplicate alias '${alias}'`);
		if (this.commands.hasOwnProperty(alias))
			throw new Error(`Cannot alias: command by name '${alias}' already exists`);
		if (!targetCommand || typeof targetCommand != "string")
			throw new Error(`Cannot alias: invalid target command '${targetCommand}'`);
		
		this.aliases[alias] = targetCommand;
		return this;
	}

	run(command, runConfig, extraArgs) {
		const runtime = new CommandRuntime(this, command, runConfig, extraArgs);
		return this._run(runtime);
	}

	pre(func) {
		this.hooks.pre = func;
		return this;
	}

	post(func) {
		this.hooks.post = func;
		return this;
	}

	_run(runtime) {
		const currentCmd = runtime.getNextCommand();

		for (const command of this.commandsList) {
			if (command.command == currentCmd) {
				runtime.setLastValidCommand(currentCmd);
				return command.invoke(runtime);
			}
		}

		if (!runtime.runConfig.suppressError)
			this._runError(runtime);

		return false;
	}

	_runError(runtime) {
		const cmdChunk = runtime.getCommandChunk(),
			lvc = runtime.lastValidCommand;

		if (lvc || !cmdChunk) {
			const list = this.commandsList.map(c => c.command).sort(),
				subcommandStr = list.join("\n");

			error(`\nFailed to find command for '${cmdChunk}'`);
			console.log(`Command '${runtime.lastValidCommand || ""}' has the following subcommands:`);
			info(`${subcommandStr}\n`);
		} else
			error(`Failed to find command for '${cmdChunk}'`);
	}
}

class Command {
	constructor(owner, command, config = {}) {
		this.helpText = owner.helpText || null;
		this.handle = owner.handle || null;
		
		applyConfigAndHooks(this, config);

		this.owner = owner;
		this.command = command;
		this.runtime = null;

		if (!isHandler(this.handle))
			throw new Error("Failed to set command: handler is not a function or Commander");
	}

	async invoke(runtime) {
		// This must be updated first, as this value might
		// become useful in hooks
		this.runtime = runtime;

		if (await this.expectHook("guard").toBe(false))
			return false;

		await this.callHook("pre");

		const options = runtime.export();
		let retVal = null,
			handler = this.handle;

		if (typeof this.handle == "string")
			handler = require(this.handle);
		
		if (await this.expectHook("intercept", options).toBe(true))
			retVal = true;
		else switch (getHandlerType(handler)) {
			case "function": {
				retVal = await handler(options, ...options.args);
				break;
			}

			case "commander":
				// handler
				handler.owner = this;
				retVal = handler._run(runtime);
				break;
		}

		await this.callHook("post", runtime);

		return retVal === undefined ? true : retVal;
	}

	help() {
		let helpText = `No help text has been set for '${this.runtime.getCommandChunk()}'`;

		switch (typeof this.helpText) {
			case "string":
				helpText = this.helpText;
				break;
			case "function":
				helpText = this.helpText(this);
				break;
		}

		console.log(helpText);
	}

	error(msg) {
		error(`@${this.runtime.getCommandChunk()} - ${msg}`);
		return false;
	}

	success(msg) {
		success(`@${this.runtime.getCommandChunk()} - ${msg}`);
		return true;
	}

	async callHook(type, ...args) {
		const hookStores = [this.hooks, this.owner.hooks],
			root = getRootCommander(this);

		if (root)
			hookStores.push(root.hooks);

		for (const store of hookStores) {
			if (store.hasOwnProperty(type) && typeof store[type] == "function") {
				const result = await store[type](this, ...args);
	
				return {
					result,
					found: true
				};
			}
		}

		return {
			result: null,
			found: false
		};
	}

	expectHook(type, ...args) {
		return {
			toBe: async val => {
				const retVal = await this.callHook(type, ...args);

				if (!retVal.found)
					return false;

				return val === retVal.result;
			}
		};
	}
}

class CommandRuntime {
	constructor(source, command, runConfig, extraArgs = []) {
		this.source = source;
		this.options = parseCLIInput(command, source.aliases, extraArgs);
		this.runConfig = runConfig || {};
		this.pointer = 0;
		this.currentCommand = null;
		this.lastValidCommand = null;
	}

	getNextCommand() {
		return this.options.args[this.pointer++];
	}

	getCommandChunk() {
		return this.options.args.slice(0, this.pointer).join(" ");
	}

	setLastValidCommand(cmd) {
		this.lastValidCommand = cmd;
	}

	export() {
		const options = Object.assign({}, this.options);
		options.args = options.args.slice(this.pointer);
		return options;
	}
}

function getHandlerType(handler) {
	if (handler instanceof Commander)
		return "commander";
	else switch (typeof handler) {
		case "function":
			return "function";
		case "string":
			return "url";
	}

	return null;
}

function isHandler(handler) {
	return getHandlerType(handler) !== null;
}

function applyConfigAndHooks(target, config) {
	if (!config)
		return;

	for (const k in config) {
		if (config.hasOwnProperty(k) && target.hasOwnProperty(k))
			target[k] = config[k];
	}

	target.hooks = {
		guard: null,
		pre: null,
		post: null,
		intercept: null
	};

	for (const k in config) {
		if (config.hasOwnProperty(k) && target.hooks.hasOwnProperty(k))
			target.hooks[k] = config[k];
	}
}

function getRootCommander(item) {
	while (true) {
		if (!item)
			return null;

		if (!item.owner)
			return item;

		item = item.owner;
	}
}

module.exports = Commander;
