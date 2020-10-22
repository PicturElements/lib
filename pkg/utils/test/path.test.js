import {
	joinPath,
	splitPath,
	normalizePath
} from "../src/path";

const PATHS = [
	{
		path: "a.b.c",
		split: ["a", "b", "c"]
	},
	{
		path: "a.b[1.0].c",
		split: ["a", "b", "1.0", "c"]
	},
	{
		path: "a.b[0].c",
		split: ["a", "b", "0", "c"]
	},
	{
		path: "a.b['0'].c",
		split: ["a", "b", "0", "c"],
		joined: "a.b[0].c"
	},
	{
		path: "a.b.0.c",
		split: ["a", "b", "0", "c"],
		joined: "a.b[0].c"
	},
	{
		path: "a.b[c]",
		split: ["a", "b", "c"],
		joined: "a.b.c"
	},
	{
		path: "a.b['c'][\"d\"][`e`]",
		split: ["a", "b", "c", "d", "e"],
		joined: "a.b.c.d.e"
	},
	{
		path: "root[\\]][']']",
		split: ["root", "]", "]"],
		joined: "root[']'][']']"
	},
	{
		path: "longer.path.with[spaced accessors]",
		split: ["longer", "path", "with", "spaced accessors"]
	},
	{
		path: "longer.path.with[  unquoted spaces  ]",
		split: ["longer", "path", "with", "  unquoted spaces  "]
	},
	{
		path: "path.with['an escaped quote\\']",
		split: ["path", "with", "'an escaped quote'"],
		joined: "path.with[\"'an escaped quote'\"]"
	},
	{
		path: "longer.path.with[  'quoted spaces'  ]",
		split: ["longer", "path", "with", "quoted spaces"],
		joined: "longer.path.with[quoted spaces]"
	},
	{
		path: "longer.path.with[  'odd \"accessors\" ]",
		split: ["longer", "path", "with", "  'odd \"accessors\" "],
		joined: "longer.path.with['  \\'odd \"accessors\" ']"
	},
	{
		path: "longer.path.with[  \"odd 'accessors' ]",
		split: ["longer", "path", "with", "  \"odd 'accessors' "],
		joined: "longer.path.with[\"  \\\"odd 'accessors' \"]"
	},
	{
		path: "path.with.an[empty].component[]",
		split: ["path", "with", "an", "empty", "component"],
		joined: "path.with.an.empty.component"
	},
	{
		path: "another[ '' ].path[''][\"\"][``].with[empty].components[]",
		split: ["another", "path", "with", "empty", "components"],
		joined: "another.path.with.empty.components"
	},
	{
		path: "path.with[reserved / separator].key",
		split: ["path", "with", "reserved / separator", "key"]
	}
];

describe("path splitting", () => {
	PATHS.forEach(({ path, split }) => {
		it(`correctly splits ${path}`, () => {
			expect(splitPath(path)).toEqual(split);
		});
	});
});

describe("path joining", () => {
	PATHS.forEach(({ path, split, joined }) => {
		const wanted = joined || path;

		it(`correctly joins into ${wanted}`, () => {
			expect(joinPath(split)).toBe(wanted);
		});
	});
});

describe("path normalization", () => {
	PATHS.forEach(({ path, joined }) => {
		const wanted = joined || path;

		it(`correctly translates to and from URL separator format for ${path}`, () => {
			const urlPath = normalizePath.with({ to: "url" })(path),
				accessorPath = normalizePath.with({ from: "url" })(urlPath);

			expect(accessorPath).toBe(wanted);
		});
	});
});
