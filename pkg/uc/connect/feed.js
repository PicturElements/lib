import feed from "../../../runtime/feed";
import * as exp from "../";

import {
	CustomJSON,
	GetterManager
} from "../";

feed(exp);

feed.add("CJ", activeFeed => new CustomJSON());

feed.add("gm", activeFeed => {
	const gm = new GetterManager({
		normal: {
			get(config, assets, resolve) {
				const { multiply } = assets;

				return {
					normalValue: 21,
					multipliedValue: multiply(21, 2),
					resolved: resolve(a => ({
						owner: a.owner,
						accessor: a.accessor
					})),
					string: resolve("notNumber").as("string").or("replaced string"),
					number: resolve("number").as("number").or(0),
					configOverridable: config.configOverridable
				};
			},
			cachePolicy: "same-inputs",
			config: {
				notNumber: "number",
				number: 42,
				configOverridable: "overridable"
			},
			assets: {
				multiply: (val, multiplier = 0) => val * multiplier
			}
		},
		group: {
			getters: {
				a(config, assets, resolve) {
					return {
						test: resolve("test"),
						outer: resolve("outer")
					};
				},
				b: {
					getters: {
						c: {
							get(config, assets, resolve) {
								console.log(config, "did resolve");

								return {
									test: resolve("test").or(42),
									outer: resolve("outer"),
									outer2: resolve("outer2"),
									outer3: resolve("outer3"),
									testing: resolve("testing").as(Object).extends("obj")
								};
							},
							cachePolicy: "same-config",
							config: {
								outer: "overwritten again"
							}
						}
					},
					cachePolicy: "same-config",
					config: {
						outer: "overwritten data",
						outer3: "outer data from within b",
						obj: { a: 1, b: 2 }
					}
				}
			},
			config: {
				outer: "outer data",
				outer2: "more outer data"
			},
			cachePolicy: "same-config"
		}
	});

	return gm;
});
