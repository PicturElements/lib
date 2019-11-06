import Input from "./input";
import Checkbox from "./checkbox";
import Count from "./count";
import Dropdown from "./dropdown";
import Media from "./media";
import Radio from "./radio";
import TextArea from "./textarea";

const inputTypes = {
	default: "text",
	checkbox: "checkbox",
	check: "checkbox",
	count: "count",
	dropdown: "dropdown",
	media: "media",
	radio: "radio",
	textarea: "textarea"
};

const inputConstructors = {
	default: Input,
	checkbox: Checkbox,
	count: Count,
	dropdown: Dropdown,
	media: Media,
	radio: Radio,
	textarea: TextArea
};

export {
	inputTypes,
	inputConstructors
};
