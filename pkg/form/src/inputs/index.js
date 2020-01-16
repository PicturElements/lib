import Input from "./input";
import Checkbox from "./checkbox";
import Coordinates from "./coordinates";
import Count from "./count";
import { default as DateInput } from "./date";
import DateTime from "./date-time";
import Dropdown from "./dropdown";
import Formatted from "./formatted";
import List from "./list";
import Media from "./media";
import Multi from "./multi";
import Radio from "./radio";
import TextArea from "./textarea";
import Time from "./time";

const inputTypes = {
	default: "text",
	checkbox: "checkbox",
	check: "checkbox",
	coordinates: "coordinates",
	count: "count",
	date: "date",
	"date-time": "date-time",
	dropdown: "dropdown",
	formatted: "formatted",
	list: "list",
	media: "media",
	multi: "multi",
	radio: "radio",
	textarea: "textarea",
	time: "time"
};

const inputConstructors = {
	default: Input,
	checkbox: Checkbox,
	coordinates: Coordinates,
	count: Count,
	date: DateInput,
	"date-time": DateTime,
	dropdown: Dropdown,
	formatted: Formatted,
	list: List,
	media: Media,
	multi: Multi,
	radio: Radio,
	textarea: TextArea,
	time: Time
};

export {
	inputTypes,
	inputConstructors
};
