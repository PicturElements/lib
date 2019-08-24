import URL from "../";

it("Correctly parses a URL", () => {
	const url = new URL("https://www.google.com/search/?q=testing");
	expect(url).toMatchObject({
		origin: "https://www.google.com",
		pathname: "/search",
		searchParams: {
			q: "testing"
		}
	});
});
