import matchQuery from "./match-query";
import filterMut from "./filter-mut";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

export default function queryFilterMut(list, q, filterOptions, queryOptions) {
	const options = createOptionsObject(filterOptions, optionsTemplates);

	return filterMut(list, item => {
		return options.invert ^ matchQuery(item, q, queryOptions);
	});
}

const optionsTemplates = composeOptionsTemplates({
	invert: true
});
