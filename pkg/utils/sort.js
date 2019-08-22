// ====== Merge sort ======
function mergesort(arr, indexArr, comparator) {
	if (typeof indexArr == "function" || indexArr === undefined) {
		// if indexArr is a function, you're attempting to run a standard sort
		comparator = typeof indexArr == "function" ? indexArr : standardComparator;
		return mergesortStandard(arr, comparator);
	}

	comparator = typeof comparator == "function" ? comparator : standardComparator;
	return mergesortIndex(arr, indexArr, comparator);
}

function mergesortStandard(arr, comparator, chunks) {
	chunks = chunks || arr.map(e => [e]);

	while (true) {
		let chunk = [],
			currChunks = [];

		for (let i = 0, l = chunks.length; i < l; i += 2) {
			const a = chunks[i],
				al = a.length,
				b = chunks[i + 1] || [],
				bl = b.length;

			let ap = 0,
				bp = 0;

			chunk = [];

			for (let j = 0; j < al + bl; j++) {
				if (bp != bl && (ap == al || comparator(a[ap], b[bp]) > 0))
					chunk.push(b[bp++]);
				else
					chunk.push(a[ap++]);
			}

			currChunks.push(chunk);
		}

		if (currChunks.length < 2)
			return chunk;

		chunks = currChunks;
	}
}

function mergesortIndex(arr, indexArr, comparator) {
	arr = arr.map((e, i) => [
		{
			item: e,
			index: indexArr[i],
		},
	]);

	return mergesortStandard(null, (a, b) => comparator(a.index, b.index), arr)
		.map(e => e.item);
}

function alphabeticSort(arr, comparator = standardComparator) {
	arr = arr.map(e => {
		if (typeof e != "string")
			throw new Error("Cannot sort: all elements must be strings");

		return [{
			lower: e.toLowerCase(),
			value: e
		}];
	});

	return mergesortStandard(null, (a, b) => comparator(a.lower, b.lower), arr)
		.map(e => e.value);
}

// ====== Utils ======

// General rule: if this returns -1, sort b before a
// if 1 is returned sort a before b
// else preserve order
function standardComparator(a, b, reverse) {
	reverse = typeof reverse == "boolean" && reverse;

	if (a == b)
		return 0;

	return (a > b ^ reverse) ? 1 : -1;
}

export {
	mergesort,
	mergesortStandard,
	mergesortIndex,
	alphabeticSort,
	standardComparator
};
