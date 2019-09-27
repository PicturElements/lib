import hasOwn from "./has-own";
import { isObject } from "./is";

export default function partition(data, partitionMap, classifier) {
	if (!isObject(partitionMap) || (!isObject(classifier) && typeof classifier != "function"))
		return partitionMap;
	
	for (const k in data) {
		if (!hasOwn(data, k))
			continue;

		let cls = null;

		if (typeof classifier == "function")
			cls = classifier(data[k], k, data);
		else
			cls = classifier[k];

		if (hasOwn(partitionMap, cls))
			partitionMap[cls][k] = data[k];
		else if (hasOwn(partitionMap, "default"))
			partitionMap.default[k] = data[k];
	}

	return partitionMap;
}
