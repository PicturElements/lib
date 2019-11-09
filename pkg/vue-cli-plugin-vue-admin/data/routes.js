const { serialize } = require("@qtxr/node-utils");

const getRoutes = config => {
	if (!config) {
		config = {
			settings: {}
		};
	}

	return [
		{
			name: "admin",
			route: config.settings.url,
			forceRender: true,
			inject: {
				dataCells: {
					loginCell: {
						fetch: serialize.rawReplaceKey(`fetch(...args) {
	return new Promise(resolve => {
		setTimeout(_ => {
			resolve(Math.random() < 0.5 ? null : { data: "abcd" });
		}, 1500);
	});
}`),
						validate: ["success", true, "Fake Login Error"]
					}
				}
			},
			meta: {
				title: "Admin",
				sidebar: {
					name: "Admin",
					display: "skip"
				},
				breadcrumb: {
					name: "Admin",
					display: "visible"
				}
			},
			children: [
				{
					name: "dashboard",
					choiceName: "dashboard",
					route: "/",
					meta: {
						title: "Dashboard",
						sidebar: {
							name: "Dashboard",
							display: "visible"
						},
						breadcrumb: {
							name: "Dashboard",
							display: "hidden"
						}
					}
				},
				{
					name: "items",
					choiceName: "items",
					route: "/items",
					meta: {
						title: "Items",
						sidebar: {
							name: "Items",
							display: "visible"
						},
						breadcrumb: {
							name: "Items",
							display: "visible"
						}
					},
					children: [
						{
							name: "new-item",
							choiceName: "add new item",
							route: "/new",
							meta: {
								title: "New Item",
								sidebar: {
									name: "New Item",
									display: "visible"
								},
								breadcrumb: {
									name: "New",
									display: "visible"
								}
							}
						},
						{
							name: "edit-item",
							choiceName: "edit item",
							route: "/edit",
							meta: {
								title: "Edit Item",
								sidebar: {
									name: "Edit Item",
									display: "visible"
								},
								breadcrumb: {
									name: "Edit",
									display: "visible"
								}
							}
						}
					]
				},
				{
					name: "view-manager",
					choiceName: "view manager",
					route: "/views",
					meta: {
						title: "View Manager",
						sidebar: {
							name: "View Manager",
							display: "visible"
						},
						breadcrumb: {
							name: "View Manager",
							display: "visible"
						}
					}
				}
			]
		}
	];
};

module.exports = getRoutes;
