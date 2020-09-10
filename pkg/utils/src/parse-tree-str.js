const WELL_FORMED_INDENT_REGEX = /^([\t ]?)\1*$/;

export default function parseTreeStr(str, options = {}) {
	const structRegex = /^([\t ]*)(.+?)\s*$/gm,
		outStruct = [];

	let stack = [{
			children: outStruct,
			indent: 0
		}],
		indent = -1,
		minIndent = 0,
		indentChar = null,
		struct = outStruct,
		line = 0;

	while (true) {
		const ex = structRegex.exec(str);
		if (!ex)
			break;

		const nextIndent = ex[1].length;

		if (nextIndent < indent) {
			const frame = stackIndentPop(stack, nextIndent);
			struct = frame && frame.children;
			minIndent = frame && frame.indent;
		}

		line++;

		if (!ex[2])
			continue;

		if (!WELL_FORMED_INDENT_REGEX.test(ex[1]) || (ex[1] && indentChar && indentChar != ex[1][0]))
			throw new SyntaxError(`Mixed indent (line ${line})`);

		if (nextIndent < minIndent)
			throw new SyntaxError(`Improper indent (line ${line})`);

		const doesIndent = indent != -1 && nextIndent > indent,
			item = {
				indent: nextIndent,
				raw: ex[2],
				children: [],
				row: line
			};

		if (!struct)
			throw new SyntaxError(`Fell out of struct stack (line ${line})`);

		if (doesIndent) {
			minIndent = indent;

			struct = struct[struct.length - 1].children;

			stack.push({
				indent,
				children: struct
			});
		}

		indentChar = ex[1][0];
		indent = nextIndent;
		stack[stack.length - 1].indent = indent;

		if (typeof options.process == "function")
			options.process(item);

		struct.push(item);
	}

	return outStruct;
}

function stackIndentPop(stack, indent) {
	while (stack.length > 1) {
		stack.pop();
		const frame = stack[stack.length - 1];

		if (frame.indent <= indent)
			return frame;
	}

	return null;
}
