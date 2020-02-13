import feed from "../../../runtime/feed";
import * as exp from "../";
import Console from "../src/console";

feed(exp);

feed.add("c", activeFeed => {
	const c = new Console({
		collapsed: true
	});

	const logTypes = ["log", "info", "warn", "error"];

	setInterval(_ => {
		const type = logTypes[~~(Math.random() * 4)];
		console[type](type);
	}, 1000);

	return c;
});
