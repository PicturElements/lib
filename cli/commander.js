/* eslint-disable no-prototype-builtins */

// TODO:
// check nested Commanders for duplicate commands/aliases

const {
	error,
	success,
	info,
	join
} = require("../pkg/node-utils");
const parseCLIInput = require("./parse-cli-input");

const HANDLER_DIR = join(__dirname, "../cli/handlers");
const validCommandRegex = /^[a-z0-9-_?]+$/i;

class Commander {
	constructor(config = {}) {
		this.helpTexts = {};
		this.command = "";

		applyConfigAndHooks(this, config);

		this.commandsList = [];
		this.aliases = {};
		this.commands = {};
		this.owner = null;
		this.currentCommandInstance = null;
	}

	cmd(command, config) {
		if (!command || typeof command != "string" || !validCommandRegex.test(command))
			throw new TypeError(`Cannot add command: command must be a string with no spaces (matching ${validCommandRegex.toString()})`);
		if (this.commands.hasOwnProperty(command))
			throw new Error(`Cannot add command: duplicate command '${command}'`);
		if (this.aliases.hasOwnProperty(command))
			throw new Error(`Cannot add command: alias by name '${command}' already exists`);

		let staged = false;

		if (typeof config == "string") {
			config = {
				handle: join(HANDLER_DIR, config)
			};
			staged = true;
		} else if (!config) {
			config = {
				handle: join(HANDLER_DIR, command)
			};
			staged = true;
		} else if (isHandler(config)) {
			config = {
				handle: config
			};
		}

		const cmd = staged ?
			new StagedCommand(this, command, config) :
			new Command(this, command, config);

		this.commandsList.push(cmd);
		this.commands[command] = cmd;
		this.currentCommandInstance = cmd;

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

	_run(runtime) {
		const currentCommand = runtime.getNextCommand();

		for (const command of this.commandsList) {
			if (command.command == currentCommand) {
				runtime.setLastValidCommand(currentCommand);
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
			if (runtime.isValidMatch())
				error(`\nFailed to find full command match for '${cmdChunk}'`);
			else
				error(`Failed to find command for '${cmdChunk}'`);

			this.logCommandsList();
		} else
			error(`Failed to find command for '${cmdChunk}'`);
	}

	getCommandsList() {
		return this.commandsList
			.filter(c => c.listable !== false)
			.map(c => c.command)
			.sort();
	}

	logCommandsList() {
		console.log(`Command '${this.command}' has the following subcommands:`);
		info(`${this.getCommandsList().join("\n")}\n`);
	}
	
	pre(func) {
		this.hooks.pre = func;
		return this;
	}

	post(func) {
		this.hooks.post = func;
		return this;
	}

	helpText(helpText) {
		this.currentCommandInstance.helpText = helpText;
		return this;
	}
}

class Command {
	constructor(owner, command, config = {}) {
		this.helpText = resolvePartitionValue(owner, "helpTexts", command);
		this.handle = resolvePartitionValue(owner, "handle");
		this.listable = true;
		
		applyConfigAndHooks(this, config);

		this.owner = owner;
		this.command = command;
		this.runtime = null;

		linkHandlerOwner(this.handle, this);

		if (!isHandler(this.handle))
			throw new Error("Failed to set command: handler is not a function or Commander");
	}

	async invoke(runtime) {
		// This must be updated first, as this value might
		// become useful in hooks
		this.runtime = runtime;

		const options = runtime.export(this);

		if (await this.expectHook("guard", options).toBe(false))
			return false;

		await this.callHook("pre", options);

		let retVal = null,
			handler = this.handle;
		
		if (await this.expectHook("intercept", options).toBe(true))
			retVal = true;
		else switch (getHandlerType(handler)) {
			case "function": {
				retVal = await handler(options);
				break;
			}

			case "commander":
				retVal = await handler._run(runtime);
				break;
		}

		await this.callHook("post", options);

		return retVal === undefined ? true : retVal;
	}

	help() {
		let helpText = null;

		switch (typeof this.helpText) {
			case "string":
				helpText = this.helpText;
				break;

			case "function":
				helpText = this.helpText(this, this.runtime.export(this));
				break;
		}

		if (!helpText)
			error(`No help text has been set for '${this.runtime.getCommandChunk()}'`);
		else
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

class StagedCommand extends Command {
	constructor(owner, command, config = {}) {
		super(owner, command, config);
		this.resolvedCommand = null;
	}

	invoke(runtime) {
		const rCommand = this.resolve();
		if (!rCommand)
			return false;

		return rCommand.invoke(runtime);
	}

	help() {
		const rCommand = this.resolve();
		if (!rCommand)
			return false;

		return rCommand.help();
	}

	resolve(connect = true) {
		if (this.resolvedCommand)
			return this.resolvedCommand;

		let config = null;

		if (typeof this.handle == "string")
			config = require(this.handle);

		if (typeof config == "function" || config instanceof Commander) {
			config = {
				handle: config
			};
		}

		if (!config) {
			error(`Failed to resolve command '${this.command}'`);
			return null;
		}

		this.resolvedCommand = new Command(
			this.owner,
			this.command,
			config
		);

		// Update parent connections
		if (connect)
			this.connect(this.owner);

		return this.resolvedCommand;
	}

	connect(owner = this.owner) {
		if (this.owner != owner)
			this.disconnect(this.owner);

		const rCommand = this.resolve(false);
		let replaced = false;

		for (let i = 0, l = owner.commandsList.length; i < l; i++) {
			const cmd = owner.commandsList[i];

			if (cmd == this) {
				owner.commandsList[i] = rCommand;
				replaced = true;
				break;
			}
		}

		if (!replaced)
			owner.commandsList.push(rCommand);
		owner.commands[this.command] = rCommand;

		linkHandlerOwner(rCommand, owner);
		return rCommand;
	}

	disconnect(owner) {
		let removed = false;

		for (let i = 0, l = owner.commandsList.length; i < l; i++) {
			const cmd = owner.commandsList[i];

			if (cmd == this) {
				owner.commandsList.splice(i, 1);
				removed = true;
				break;
			}
		}

		delete owner.commands[this.command];
		return removed;
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
		this.currentCommand = this.options.args[this.pointer++];
		return this.currentCommand;
	}

	getCommandChunk() {
		return this.options.args.slice(0, this.pointer).join(" ");
	}

	isValidMatch() {
		const last = this.lastCommand || this.options.args[this.options.args.length - 1];
		return last == this.lastValidCommand;
	}

	setLastValidCommand(cmd) {
		this.lastValidCommand = cmd;
	}

	export(cmd) {
		const options = Object.assign({}, this.options);
		options.args = options.args.slice(this.pointer);
		options.cmd = cmd;
		options.runtime = this;
		options.root = getRootCommander(cmd);
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

function resolvePartitionValue(cmdOrOwner, key, secondaryKey) {
	let stores = [];

	// If it's a Command instance, check own,
	// owner, and root properties
	// Otherwise, only check owner and root properties
	if (cmdOrOwner instanceof Command)
		stores = [cmdOrOwner[key], cmdOrOwner.owner[key]];
	else
		stores = [cmdOrOwner[key]];

	const root = getRootCommander(cmdOrOwner);

	if (root && cmdOrOwner != root)
		stores.push(root[key]);

	for (const store of stores) {
		if (secondaryKey === undefined) {
			if (store != null)
				return store;
		} else if (store) {
			if (store.hasOwnProperty(secondaryKey) && store[secondaryKey] != null)
				return store[secondaryKey];
		}
	}

	return null;
}

function linkHandlerOwner(handler, owner) {
	if (handler instanceof Commander) {
		handler.owner = owner;
		handler.command = owner.command;
	}
}

module.exports = Commander;
