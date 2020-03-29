import feed from "../../../runtime/feed";
import * as exp from "../";
import * as internals from "../internal";

feed(Object.assign(
	{},
	exp,
	internals
));
