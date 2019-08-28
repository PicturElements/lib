import URL from "../src/url";

it("Correctly parses a URL", () => {
	const url = new URL("https://www.google.com/search#test?q=testing&test");
	expect(url.href).toBe("https://www.google.com/search?q=testing&test#test");
	expect(url.pathname).toBe("/search");
	expect(url.searchParams).toStrictEqual({
		q: "testing",
		test: undefined
	});
});

it("Only returns a hostname when a protocol is specified", () => {
	const protocolURL = new URL("http://myoldwebsite.com");
	expect(protocolURL.hostname).toBe("myoldwebsite.com");
	expect(protocolURL.pathname).toBe("");

	const fileURL = new URL("myoldsystemfile.com");
	expect(fileURL.hostname).toBe("");
	expect(fileURL.pathname).toBe("/myoldsystemfile.com");
});
