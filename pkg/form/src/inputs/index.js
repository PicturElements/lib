import Input from "./input";
import Checkbox from "./checkbox";
import Count from "./count";
import Dropdown from "./dropdown";
import Image from "./image";
import Radio from "./radio";

const inputTypes = {
	default: "text",
	checkbox: "checkbox",
	check: "checkbox",
	count: "count",
	dropdown: "dropdown",
	image: "image",
	img: "image",
	radio: "radio"
};

const inputConstructors = {
	default: Input,
	checkbox: Checkbox,
	count: Count,
	dropdown: Dropdown,
	image: Image,
	radio: Radio
};

export {
	inputTypes,
	inputConstructors
};
