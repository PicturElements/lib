import Input from "./input";
import Checkbox from "./checkbox";
import Count from "./count";
import Dropdown from "./dropdown";
import Media from "./media";
import Multi from "./multi";
import Radio from "./radio";
import TextArea from "./textarea";

const inputTypes = {
	default: "text",
	checkbox: "checkbox",
	check: "checkbox",
	count: "count",
	dropdown: "dropdown",
	media: "media",
	multi: "multi",
	radio: "radio",
	textarea: "textarea"
};

const inputConstructors = {
	default: Input,
	checkbox: Checkbox,
	count: Count,
	dropdown: Dropdown,
	media: Media,
	multi: Multi,
	radio: Radio,
	textarea: TextArea
};

export {
	inputTypes,
	inputConstructors
};
