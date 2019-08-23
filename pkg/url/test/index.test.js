import URL from "../";

it("Correctly parses a URL", () => {
	const url = new URL("https://www.google.com/search/?q=testing");
	expect(url).toMatchObject({
		valid: true,
		domain: "https://www.google.com",
		path: [{
			value: "search"
		}],
		queryDict: {
			q: "testing"
		}
	});
});
