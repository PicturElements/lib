import URL from "../src/url";

it("correctly parses a URL", () => {
	const url = new URL("https://www.google.com/search#test?q=testing&test");
	expect(url.href).toBe("https://www.google.com/search?q=testing&test#test");
	expect(url.pathname).toBe("/search");
	expect(url.searchParams).toStrictEqual({
		q: "testing",
		test: undefined
	});
});

it("only returns a hostname when a protocol is specified", () => {
	const protocolURL = new URL("http://mywebsite.com");
	expect(protocolURL.hostname).toBe("mywebsite.com");
	expect(protocolURL.pathname).toBe("");

	const fileURL = new URL("mysystemfile.com");
	expect(fileURL.hostname).toBe("");
	expect(fileURL.pathname).toBe("mysystemfile.com");
});

function getURLData(url) {
	url = new URL(url);

	const descriptors = Object.getOwnPropertyDescriptors(Object.getPrototypeOf(url)),
		data = {};

	for (const k in descriptors) {
		if (descriptors.hasOwnProperty(k))
			data[k] = url[k];
	}

	return data;
}

it("correctly handles slightly odd URLs", () => {
	expect(getURLData("https://www.ncbi.nlm.nih.gov/taxonomy")).toMatchObject({
		hash: "",
		host: "www.ncbi.nlm.nih.gov",
		hostname: "www.ncbi.nlm.nih.gov",
		href: "https://www.ncbi.nlm.nih.gov/taxonomy",
		origin: "https://www.ncbi.nlm.nih.gov",
		pathname: "/taxonomy",
		port: "",
		protocol: "https:",
		relative: false,
		search: "",
		searchParams: {}
	});

	expect(getURLData("http://localhost:1234/url?query=q#hash")).toMatchObject({
		hash: "#hash",
		host: "localhost:1234",
		hostname: "localhost",
		href: "http://localhost:1234/url?query=q#hash",
		origin: "http://localhost:1234",
		pathname: "/url",
		port: "1234",
		protocol: "http:",
		relative: false,
		search: "?query=q",
		searchParams: {
			query: "q"
		}
	});

	expect(getURLData("https://old.reddit.com/r/url/")).toMatchObject({
		hash: "",
		host: "old.reddit.com",
		hostname: "old.reddit.com",
		href: "https://old.reddit.com/r/url",
		origin: "https://old.reddit.com",
		pathname: "/r/url",
		port: "",
		protocol: "https:",
		relative: false,
		search: "",
		searchParams: {}
	});
});

it("correctly handles relative paths", () => {
	expect(getURLData("/url/test/?query=q")).toMatchObject({
		hash: "",
		host: "",
		hostname: "",
		href: "/url/test?query=q",
		origin: "",
		pathname: "/url/test",
		port: "",
		protocol: "",
		relative: true,
		search: "?query=q",
		searchParams: {
			query: "q"
		}
	});

	expect(getURLData("url/test/?query=q")).toMatchObject({
		hash: "",
		host: "",
		hostname: "",
		href: "url/test?query=q",
		origin: "",
		pathname: "url/test",
		port: "",
		protocol: "",
		relative: true,
		search: "?query=q",
		searchParams: {
			query: "q"
		}
	});

	expect(getURLData("./url/test/?query=q")).toMatchObject({
		hash: "",
		host: "",
		hostname: "",
		href: "url/test?query=q",
		origin: "",
		pathname: "url/test",
		port: "",
		protocol: "",
		relative: true,
		search: "?query=q",
		searchParams: {
			query: "q"
		}
	});

	expect(getURLData("../url/test/?query=q")).toMatchObject({
		hash: "",
		host: "",
		hostname: "",
		href: "../url/test?query=q",
		origin: "",
		pathname: "../url/test",
		port: "",
		protocol: "",
		relative: true,
		search: "?query=q",
		searchParams: {
			query: "q"
		}
	});
});

it("correctly joins URLs", () => {
	expect(URL.join("a/b/d", "../c/d/e")).toBe("a/b/c/d/e");
	expect(URL.join("/a/b", "/c/d/e")).toBe("/a/b/c/d/e");
	expect(URL.join("a/b", "../../c/d/e")).toBe("c/d/e");
	expect(URL.join("/a/b", "../../c/d/e")).toBe("/c/d/e");
	expect(URL.join("/a/b", "../../../c/d/e")).toBe("../c/d/e");
	expect(URL.join("/a/b", "./c/d/f", "../e/f", "g/")).toBe("/a/b/c/d/e/f/g");
	expect(URL.join("/a/b", "./c/x/../d/f", "../e/f", "g/")).toBe("/a/b/c/d/e/f/g");
});

it("correctly joins abolute URLs and treats URLs with a preceding '/' as absolute if the joining URL is absolute", () => {
	expect(URL.join("https://www.ncbi.nlm.nih.gov/taxonomy", "birds/parrots")).toBe("https://www.ncbi.nlm.nih.gov/taxonomy/birds/parrots");
	expect(URL.join("https://www.ncbi.nlm.nih.gov/taxonomy", "./birds/parrots")).toBe("https://www.ncbi.nlm.nih.gov/taxonomy/birds/parrots");
	expect(URL.join("https://www.ncbi.nlm.nih.gov/taxonomy", "/birds/parrots")).toBe("https://www.ncbi.nlm.nih.gov/birds/parrots");
	expect(URL.join("https://www.ncbi.nlm.nih.gov/taxonomy/meercats", "../birds/parrots")).toBe("https://www.ncbi.nlm.nih.gov/taxonomy/birds/parrots");
});

it("errors when trying to join multiple abolute paths", () => {
	const mocked = jest.spyOn(console, "error");

	URL.join("https://a.com", "http://localhost:1234");
	URL.join("https://a.com", "localhost:1234");
	URL.join("/a", "https://b.com");

	expect(mocked).toHaveBeenCalledTimes(2);
	mocked.mockClear();
});
