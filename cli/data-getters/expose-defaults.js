const defaults = {

feed:
`import feed from "../../../runtime/feed";
import * as exp from "../";

feed(exp);
`,

default: "// TODO: add export"

};

module.exports = function getExposeDefault(fileName) {
	return defaults[fileName] || defaults.default;
};
