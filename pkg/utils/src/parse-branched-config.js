import { isObject } from "./is";
import { uid } from "./string";
import { assign } from "./object";
import get from "./get";
import inject from "./inject";
import hasOwn from "./has-own";
import filterMut from "./filter-mut";
import matchType from "./match-type";

const IGNORE_MAP = {
	uid: true,
	root: true,
	extensions: true,
	aliases: true,
	input: true,
	scope: true,
	requiresCleaning: true
};

export default function parseBranchedConfig(config, options = {}, err = mkErrorMessage) {
	const references = [],
		groups = {},
		names = {},
		groupKey = typeof options.groupKey == "string" ?
			options.groupKey :
			null,
		schemas = {},
		defSchemas = options.schemas || {},
		defSchema = options.schema || {},
		scopes = {},
		branchableScopes = [],
		inits = {},
		extensionKeys = Array.isArray(options.extensionKeys) ?
			options.extensionKeys :
			(options.extensionKey ? [options.extensionKey] : []),
		extendables = [],
		aliasKeys = Array.isArray(options.aliasKeys) ?
			options.aliasKeys :
			(options.aliasKey ? [options.aliasKey] : []);

	schemas.step = defSchemas.step || defSchema;
	schemas.leaf = defSchemas.leaf || defSchema;
	schemas.reference = defSchemas.reference || defSchema;

	if (options.scopes) {
		for (const k in options.scopes) {
			if (!hasOwn(options.scopes, k))
				continue;

			const scopeData = options.scopes[k],
				scope = {
					name: k
				};
			let names = [k];

			if (typeof scopeData == "string")
				names.push(scopeData);
			else if (Array.isArray(scopeData))
				names = names.concat(scopeData);
			else if (isObject(scopeData)) {
				const al = scopeData.aliases || scopeData.alias;

				if (typeof al == "string")
					names.push(al);
				else if (Array.isArray(al))
					names = names.concat(scopeData);
			}

			if (!hasOwn(scopes, k) && k != "group")
				branchableScopes.push(scope);

			for (let i = 0, l = names.length; i < l; i++)
				scopes[names[i]] = scope;
		}
	}

	if (groupKey && !hasOwn(scopes, "group")) {
		scopes.group = {
			name: "group"
		};
	}

	if (typeof options.init == "function") {
		inits.step = options.init;
		inits.leaf = options.init;
		inits.reference = options.init;
	} else if (isObject(options.init)) {
		inits.step = options.init.step || null;
		inits.leaf = options.init.leaf || null;
		inits.reference = options.init.reference || null;
	}

	const collect = (node, refs, name, scope) => {
		const n = {
			uid: uid(),
			root: false,
			extensions: [],
			aliases: [],
			input: node,
			scope,
			requiresCleaning: true
		};

		if (typeof node == "function") {
			n.type = "leaf";
			n.name = name;
		} else if (typeof node == "string") {
			Object.assign(n, createReference(node));
			n.name = name;
		} else if (isObject(node)) {
			n.type = "step";
			n.name = typeof node.name == "string" ?
				node.name :
				name;

			for (let i = 0, l = extensionKeys.length; i < l; i++) {
				const ext = node[extensionKeys[i]];
				if (!ext)
					continue;

				if (Array.isArray(ext))
					n.extensions = n.extensions.concat(ext);
				else
					n.extensions.push(ext);
			}

			for (let i = 0, l = aliasKeys.length; i < l; i++) {
				const al = node[aliasKeys[i]];
				if (!al)
					continue;

				if (Array.isArray(al))
					n.aliases = n.aliases.concat(al);
				else
					n.aliases.push(al);
			}

			const branches = [];
			let newRefs = refs,
				branchLength = 0;

			if (n.name) {
				refs[n.name] = {
					type: "junction",
					node: n,
					refs: {}
				};
				newRefs = refs[n.name].refs;
			}

			for (let i = 0, l = branchableScopes.length; i < l; i++) {
				const branch = createBranch(node, newRefs, branchableScopes[i]);
				branches.push({
					scope: branchableScopes[i],
					branch
				});
				branchLength += branch.length;
			}

			if (branchLength) {
				for (let i = 0, l = branches.length; i < l; i++)
					n[branches[i].scope.name] = branches[i].branch;
			} else
				n.type = "leaf";
		} else
			throw new Error(err(`invalid node data${name ? ` at ${name}` : ""}: found data of type ${typeof node}. Expected string, function, or object`));

		const schema = schemas[n.type];

		if (isObject(schema)) {
			for (const k in schema) {
				if (!hasOwn(schema, k))
					continue;

				const schemaItem = schema[k];

				if (schemaItem && hasOwn(schemaItem, "type")) {
					const matches = matchType(node[k], schemaItem.type);
					if (matches)
						n[k] = node[k];
					else if (hasOwn(schemaItem, "default"))
						n[k] = schemaItem.default;
				} else if (matchType(node[k], schemaItem))
					n[k] = node[k];
			}
		} else if (isObject(node))
			assign(n, node);

		// Defer initialization if node extends one or more
		// pieces of data
		if (!n.extensions.length) {
			if (typeof inits[n.type] == "function")
				inits[n.type](n, node, scope);
		}

		return n;
	};

	const createReference = str => {
		const [_, scopeName, accessor] = /(?:(\w+):)?(.*)/.exec(str);
		const ref = {
			type: "reference",
			name: null,
			ref: str,
			refValue: null,
			accessor
		};

		if (scopeName && hasOwn(scopes, scopeName))
			ref.scope = scopes[scopeName];
		else
			ref.scope = null;

		return ref;
	};

	const createBranch = (node, refs, scope) => {
		const branch = scope && node[scope.name],
			outBranch = [];

		if (typeof branch == "string") {
			outBranch.push(
				collect(branch, refs, null, scope)
			);
		} else if (isObject(branch)) {
			if (groupKey && hasOwn(branch, groupKey))
				addGroupName(branch, outBranch);

			for (const k in branch) {
				if (!hasOwn(branch, k) || k == groupKey)
					continue;
				
				outBranch.push(
					collect(branch[k], refs, k, scope)
				);
			}
		} else if (Array.isArray(branch)) {
			for (let i = 0, l = branch.length; i < l; i++) {
				const n = collect(branch[i], refs, null, scope);

				if (n.type != "reference" && !n.name)
					throw new Error(err("unnamed node found within array branch construct"));

				outBranch.push(n);
			}
		}

		for (let i = 0, l = outBranch.length; i < l; i++) {
			const nodes = resolveAliases(outBranch[i]);

			for (let j = 0, l2 = nodes.length; j < l2; j++) {
				const node = nodes[j];

				if (node.type == "leaf" && node.name)
					addName(refs, scope, node);
				
				if (node.type == "reference") {
					if (node.name)
						addName(refs, scope, node);

					const refContext = {
						node,
						parent: outBranch,
						idx: i
					};

					node.refContext = refContext;
					references.push(refContext);
				}

				if (j > 0)
					outBranch.push(node);
				if (node.extensions.length)
					extendables.push(node);
			}
		}

		return outBranch;
	};

	const addGroupName = (group, data) => {
		const name = group[groupKey];

		if (hasOwn(groups, name))
			throw new Error(err(`group '${name}' already defined`));

		groups[name] = data;
	};

	const addName = (refs, scope, node) => {
		if (!hasOwn(refs, node.name)) {
			refs[node.name] = {
				type: "leaf"
			};

			for (let i = 0, l = branchableScopes.length; i < l; i++)
				refs[node.name][branchableScopes[i].name] = null;
		}

		if (refs[node.name][scope.name] != null)
			throw new Error(err(`node '${node.name}' already defined`));

		refs[node.name][scope.name] = node;
	};

	const resolveAliases = node => {
		const nodes = [node],
			aliases = [node.name],
			aliasMap = {
				[node.name]: true
			};

		for (let i = 0, l = node.aliases.length; i < l; i++) {
			const alias = node.aliases[i];
			if (typeof alias != "string" || hasOwn(aliasMap, alias))
				continue;

			aliases.push(alias);
			aliasMap[alias] = true;
		}

		for (let i = 1, l = aliases.length; i < l; i++) {
			const alias = aliases[i],
				n = Object.assign({}, node);

			n.name = alias;
			n.aliases = aliases.filter(al => al != alias);
			nodes.push(n);
		}

		return nodes;
	};

	const resolveRefValue = ref => {
		const refNode = typeof ref == "string" ?
				createReference(ref) :
				ref.node,
			matches = [],
			matched = {};

		if (groupKey && (refNode.scope == null || refNode.scope == "group") && hasOwn(groups, refNode.accessor)) {
			matches.push({
				target: "group",
				name: refNode.accessor,
				value: groups[refNode.accessor]
			});
		}

		for (let i = 0, l = branchableScopes.length; i < l; i++) {
			const scope = branchableScopes[i];
			if (refNode.scope != null && refNode.scope != scope)
				continue;

			const node = resolveTypedRef(names, refNode.accessor, scope);
			if (!node || hasOwn(matched, node.uid))
				continue;

			matches.push({
				target: scope.name,
				value: node
			});
			matched[node.uid] = true;
		}

		if (!matches.length)
			throw new Error(err(`cannot access '${refNode.accessor}'`));
		if (matches.length > 1)
			throw new Error(err(`ambiguous accessor '${refNode.accessor}' (matches ${matches.map(m => m.target).join(", ")} modes)`));

		const match = matches[0];
		match.ref = ref;
		return match;
	};

	const resolveTypedRef = (source, accessor, scope) => {
		const refNode = get(source, accessor, null, {
			resolve(key, idx, split, data) {
				if (!data)
					return null;
	
				if (data.type == "junction")
					return [key, data.refs];
			}
		});
	
		if (!refNode)
			return null;
	
		if (refNode.type == "junction")
			return refNode.node;
	
		let node = refNode[scope.name];
	
		if (!node)
			return null;
	
		while (node.type == "reference") {
			if (!node.refValue)
				node = resolveRefValue(node.refContext).value;
			else
				node = node.refValue.value;
		}
	
		return node || null;
	};

	const resolveExtensions = (node, inPlace, used = {}) => {
		const extensions = node.extensions,
			pendingExtension = {};

		for (let i = 0, l = extensions.length; i < l; i++) {
			const extension = extensions[i];

			if (typeof extension == "string") {
				if (hasOwn(used, extension))
					continue;

				used[extension] = true;

				const d = resolveRefValue(extension);
				if (d.target == "group")
					throw new Error(err(`cannot extend group (at reference '${extension}')`));
				if (d.value == node)
					continue;

				if (d.value.extensions.length) {
					inject(pendingExtension, resolveExtensions(d.value, false, used), {
						shallow: true,
						override: true,
						overrideNullish: true,
						ignore: IGNORE_MAP
					});
				} else {
					inject(pendingExtension, d.value, {
						shallow: true,
						override: true,
						overrideNullish: true,
						ignore: IGNORE_MAP
					});
				}
			} else if (isObject(extension)) {
				inject(pendingExtension, extension, {
					shallow: true,
					override: true,
					overrideNullish: true,
					ignore: IGNORE_MAP
				});
			} else
				throw new Error(err(`invalid extension of type ${typeof extension}`));
		}

		const out = inject(node, pendingExtension, {
			cloneTarget: !inPlace,
			shallow: true,
			overrideNullish: true,
			ignore: IGNORE_MAP
		});

		for (let i = 0, l = branchableScopes.length; i < l; i++) {
			if (out[branchableScopes[i].name] && out[branchableScopes[i].name].length) {
				out.type = "step";
				break;
			}
		}

		return out;
	};

	const resolveGroup = (group, out = [], usedGroups = {}, assigned = {}) => {
		const nodes = group.value;
		usedGroups[group.name] = true;

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];

			if (node.type == "reference") {
				if (node.refValue.target != "group" || hasOwn(usedGroups, node.refValue.name))
					continue;

				resolveGroup(node.refValue, out, usedGroups, assigned);
			} else if (!hasOwn(assigned, node.name)) {
				out.push(node);
				assigned[node.name] = true;
			}
		}

		return out;
	};

	const insertNode = (node, ref) => {
		const { parent, idx } = ref,
			wrapper = {
				type: "wrapper",
				node,
				referenceNode: ref.node,
				uid: uid(),
				root: false,
				requiresCleaning: true
			};

		for (let i = 0, l = parent.length; i < l; i++) {
			if (hasName(parent[i], ref)) {
				parent[i] = wrapper;
				return;
			}
		}

		parent[idx] = wrapper;
	};

	const insertGroup = (group, ref) => {
		const { parent } = ref,
			parLen = parent.length;

		for (let i = 0, l = group.length; i < l; i++) {
			const node = group[i];
			let found = false;

			for (let j = 0; j < parLen; j++) {
				if (hasName(parent[j], node)) {
					parent[j] = node;
					found = true;
					break;
				}
			}

			if (!found)
				parent.push(node);
		}
	};

	const getName = node => {
		if (node.type == "wrapper")
			return node.node.name;

		return node.name;
	};

	const hasName = (node, node2) => {
		const name = getName(node2);

		if (node.type == "reference" || name == null)
			return false;

		if (node.type == "wrapper")
			return node.node.name == name;

		return node.name == name;
	};

	const clean = node => {
		delete node.requiresCleaning;

		if (node.type == "wrapper")
			clean(node.node);
		else {
			for (let i = 0, l = branchableScopes.length; i < l; i++)
				filterMut(node[branchableScopes[i].name], filter);
		}

		return node;
	};

	const filter = node => {
		if (node.type == "reference")
			return false;

		if (node.type == "step" && node.requiresCleaning)
			clean(node);
		else
			delete node.requiresCleaning;

		return true;
	};

	// Root level checks
	if (typeof config == "string")
		throw new Error(err("references not allowed at root level"));

	const collected = collect(
		config,
		names,
		null,
		scopes[options.defaultScope] || null
	);

	// Resolve reference values, insert singular nodes
	for (let i = 0, l = references.length; i < l; i++) {
		const v = resolveRefValue(references[i]);
		references[i].node.refValue = v;

		if (v.target != "group")
			insertNode(v.value, v.ref);
	}

	// Resolve and insert groups
	for (let i = 0, l = references.length; i < l; i++) {
		const v = references[i].node.refValue;

		if (v.target == "group")
			insertGroup(resolveGroup(v), v.ref);
	}

	// Resolve extensions
	for (let i = 0, l = extendables.length; i < l; i++) {
		const node = extendables[i];
		resolveExtensions(node, true);

		if (typeof inits[node.type] == "function")
			inits[node.type](node, node.input, node.scope);
	}

	clean(collected);
	collected.root = true;
	return collected;
}

function mkErrorMessage(msg) {
	return `Cannot parse branched configuration: ${msg}`;
}
