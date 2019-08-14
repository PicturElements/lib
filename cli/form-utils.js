const Form = require("./form");

async function booleanQuestion(question = "Ok?", defaultAnswer = "yes", cancelAnswer = "no", rl = false) {
	const testResponse = response => response != cancelAnswer;

	const form = new Form({
		name: "response",
		value: testResponse(defaultAnswer),
		question: `${question} (${defaultAnswer})`,
		process: testResponse
	});

	await form.cli();
	return form.extract().response;
}

module.exports = {
	booleanQuestion
};