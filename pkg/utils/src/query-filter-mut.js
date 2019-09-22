import queryMatch from "./query-match";
import filterMut from "./filter-mut";
import {
	composeOptionsTemplates,
	createOptionsObject
} from "./options";

export default function queryFilterMut(list, q, filterOptions, queryOptions) {
	const options = createOptionsObject(filterOptions, queryFilterTemplates);

	return filterMut(list, item => {
		return options.invert ^ queryMatch(item, q, queryOptions);
	});
}

const queryFilterTemplates = composeOptionsTemplates({
	invert: true
});
