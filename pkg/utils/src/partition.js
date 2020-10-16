import { isObject } from "./is";
import hasOwn from "./has-own";

export default function partition(data, partitionMap, classifier, defaultPartition = "default") {
	if (!isObject(partitionMap) || (!isObject(classifier) && typeof classifier != "function"))
		return partitionMap;

	for (const k in data) {
		if (!hasOwn(data, k, false))
			continue;

		let cls = null;

		if (typeof classifier == "function")
			cls = classifier(data[k], k, data);
		else
			cls = classifier[k];

		if (hasOwn(partitionMap, cls))
			partitionMap[cls][k] = data[k];
		else if (hasOwn(partitionMap, defaultPartition) && cls != "garbage")
			partitionMap[defaultPartition][k] = data[k];
	}

	return partitionMap;
}
