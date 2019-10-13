import feed from "../../../runtime/feed";
import * as exp from "../";
import { CustomJSON } from "../";

feed(exp);

feed.add("CJ", activeFeed => new CustomJSON());
