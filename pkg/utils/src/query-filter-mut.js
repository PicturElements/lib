import {
	composeOptionsTemplates,
	createOptionsObject
} from "./internal/options";
import matchQuery from "./match-query";
import filterMut from "./filter-mut";

const OPTIONS_TEMPLATES = composeOptionsTemplates({
	invert: true
});

export default function queryFilterMut(list, q, filterOptions, queryOptions) {
	const options = createOptionsObject(filterOptions, OPTIONS_TEMPLATES);

	return filterMut(list, item => {
		return options.invert ^ matchQuery(item, q, queryOptions);
	});
}
