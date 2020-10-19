import {
	mkPath,
	splitPath
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
		combined: "a.b[0].c"
	},
	{
		path: "a.b.0.c",
		split: ["a", "b", "0", "c"],
		combined: "a.b[0].c"
	},
	{
		path: "a.b[c]",
		split: ["a", "b", "c"],
		combined: "a.b.c"
	},
	{
		path: "a.b['c'][\"d\"][`e`]",
		split: ["a", "b", "c", "d", "e"],
		combined: "a.b.c.d.e"
	},
	{
		path: "root[\\]][']']",
		split: ["root", "]", "]"],
		combined: "root[']'][']']"
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
		combined: "path.with[\"'an escaped quote'\"]"
	},
	{
		path: "longer.path.with[  'quoted spaces'  ]",
		split: ["longer", "path", "with", "quoted spaces"],
		combined: "longer.path.with[quoted spaces]"
	},
	{
		path: "longer.path.with[  'odd \"accessors\" ]",
		split: ["longer", "path", "with", "  'odd \"accessors\" "],
		combined: "longer.path.with['  \\'odd \"accessors\" ']"
	},
	{
		path: "longer.path.with[  \"odd 'accessors' ]",
		split: ["longer", "path", "with", "  \"odd 'accessors' "],
		combined: "longer.path.with[\"  \\\"odd 'accessors' \"]"
	},
	{
		path: "path.with.an[empty].component[]",
		split: ["path", "with", "an", "empty", "component"],
		combined: "path.with.an.empty.component"
	},
	{
		path: "another[ '' ].path[''][\"\"][``].with[empty].components[]",
		split: ["another", "path", "with", "empty", "components"],
		combined: "another.path.with.empty.components"
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
	PATHS.forEach(({ path, split, combined }) => {
		const wanted = combined || path;

		it(`correctly joins into ${wanted}`, () => {
			expect(mkPath(split)).toBe(wanted);
		});
	});
});
