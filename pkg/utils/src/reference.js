import {
	setEntry,
	deleteEntry
} from "./collection";

const REFERENCE_TOKEN = Object.freeze({ description: "reference token" }),
	REFERENCE_COLLECTOR_TOKEN = Object.freeze({ description: "reference collector token" });

function mkReference(parent, key) {
	return {
		parent,
		key,
		referenceToken: REFERENCE_TOKEN
	};
}

function mkReferenceCollector() {
	return {
		references: [],
		referenceCollectorToken: REFERENCE_COLLECTOR_TOKEN
	};
}

function isReference(candidate) {
	return Boolean(candidate) && candidate.referenceToken == REFERENCE_TOKEN;
}

function isReferenceCollector(candidate) {
	return Boolean(candidate) && candidate.referenceCollectorToken == REFERENCE_COLLECTOR_TOKEN;
}

function attachReference(collector, parent, key) {
	collector.references.push(
		mkReference(parent, key)
	);

	setEntry(parent, key, collector);
	return collector;
}

function mountReferences(collector, value) {
	const references = collector.references;

	for (let i = 0, l = references.length; i < l; i++) {
		const ref = references[i];

		deleteEntry(ref.parent, ref.key, collector);
		setEntry(ref.parent, ref.key, value);
	}

	references.length = 0;
}

export {
	mkReference,
	mkReferenceCollector,
	isReference,
	isReferenceCollector,
	attachReference,
	mountReferences
};
