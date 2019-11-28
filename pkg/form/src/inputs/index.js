import Input from "./input";
import Checkbox from "./checkbox";
import Count from "./count";
import Dropdown from "./dropdown";
import Formatted from "./formatted";
import Media from "./media";
import Multi from "./multi";
import Radio from "./radio";
import TextArea from "./textarea";
import Time from "./time";

const inputTypes = {
	default: "text",
	checkbox: "checkbox",
	check: "checkbox",
	count: "count",
	dropdown: "dropdown",
	formatted: "formatted",
	media: "media",
	multi: "multi",
	radio: "radio",
	textarea: "textarea",
	time: "time"
};

const inputConstructors = {
	default: Input,
	checkbox: Checkbox,
	count: Count,
	dropdown: Dropdown,
	formatted: Formatted,
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
