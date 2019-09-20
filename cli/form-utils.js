const Form = require("./form");

async function booleanQuestion(question = "Ok? (y/n)", defaultAnswer = "y", cancelAnswer = "n") {
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

async function question(q = "Ok? (y/n)", defaultAnswer = "y", options = {}) {
	const form = new Form({
		name: "response",
		value: defaultAnswer,
		question: `${q} (${defaultAnswer})`,
		...options
	});

	await form.cli();
	return form.extract().response;
}

module.exports = {
	booleanQuestion,
	question
};
