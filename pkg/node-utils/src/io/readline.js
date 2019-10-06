const promisify = require("../promisify");

function ask(rl, ...args) {
	return promisify(
		rl.question.bind(rl), null, null
	)(args);
}

module.exports = {
	ask
};
