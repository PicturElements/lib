import { isObject } from "./is";
import { uid } from "./str";
import get from "./get";
import hasOwn from "./has-own";
import filterMut from "./filter-mut";
import matchType from "./match-type";

export default function parseBranchedConfig(config, options = {}, err = throwError) {
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
		inits = {};

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
			visited: false,
			cleaned: false,
			uid: uid()
		};

		if (typeof node == "function") {
			n.type = "leaf";
			n.name = name;
		} else if (typeof node == "string") {
			const [_, scopeName, accessor] = /(?:(\w+):)?(.*)/.exec(node);
			n.type = "reference";
			n.name = name;
			n.ref = node;
			n.refValue = null;

			if (scopeName && hasOwn(scopes, scopeName))
				n.scope = scopes[scopeName];
			else
				n.scope = null;

			n.accessor = accessor;
		} else if (isObject(node)) {
			n.type = "step";
			n.name = typeof node.name == "string" ?
				node.name :
				name;

			const branches = [];
			let newRefs = refs,
				branchLength = 0;

			if (!name && n.name) {
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
			err(`invalid node data${name ? ` at ${name}` : ""}: found data of type ${typeof node}. Expected string, function, or object`);

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
			Object.assign(n, node);

		if (typeof inits[n.type] == "function")
			inits[n.type](n, node, scope);

		return n;
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
				addGroup(branch, outBranch);

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
					err(`unnamed node found within array branch construct`);

				outBranch.push(n);
			}
		}

		for (let i = 0, l = outBranch.length; i < l; i++) {
			const node = outBranch[i];

			if (node.type == "leaf" && node.name)
				addName(refs, scope, node);
			else if (node.type == "reference") {
				references.push({
					node,
					parent: outBranch,
					idx: i
				});
			}
		}

		return outBranch;
	};

	const addGroup = (group, data) => {
		const name = group[groupKey];

		if (hasOwn(groups, name))
			err(`group '${name}' already defined`);

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

		if (refs[node.name][scope] != null)
			err(`node '${node.name}' already defined`);

		refs[node.name][scope] = node;
	};

	const resolveRefValue = ref => {
		const refNode = ref.node,
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
			err(`cannot access '${refNode.accessor}'`);
		if (matches.length > 1)
			err(`ambiguous accessor '${refNode.accessor}' (matches ${matches.map(m => m.target).join(", ")} modes)`);

		const match = matches[0];
		match.ref = ref;
		return match;
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
				visited: false,
				node,
				cleaned: false,
				referenceNode: ref.node,
				uid: uid()
			};

		for (let i = 0, l = parent.length; i < l; i++) {
			if (hasName(parent[i], node)) {
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
		const filter = n => {
			if (n.type == "reference")
				return false;

			if (n.type == "step" && !node.cleaned)
				clean(n);

			return true;
		};

		node.cleaned = true;

		if (node.type == "wrapper")
			clean(node.node);
		else {
			filterMut(node.branch, filter);
			filterMut(node.branchPassive, filter);
		}

		return node;
	};

	// Root level checks
	if (typeof config == "string")
		err("references not allowed at root level");

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

	return clean(collected);
}

function resolveTypedRef(source, accessor, scope) {
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

	return refNode[scope.name] || null;
}

function throwError(msg) {
	throw new Error(`Cannot parse branched configuration: ${msg}`);
}
