import feed from "../../../runtime/feed";
import * as exp from "../";
import Console from "../src/console";

feed(exp);

feed.add("c", activeFeed => {
	const c = new Console({
		collapsed: true
	});
	return c;
});
