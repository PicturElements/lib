import {
	insertHeapNodeMin,
	insertHeapNodeMax,
	extractHeapNodeMin,
	extractHeapNodeMax,
	isValidHeapMin,
	isValidHeapMax
} from "../src/binary-heap";

describe("correct insertions and extractions with preserved heap properties", () => {
	test("min heap", () => {
		const heap = [];

		for (let i = 14; i >= 0; i--)
			insertHeapNodeMin(heap, i)();

		while (heap.length) {
			expect(isValidHeapMin(heap)).toBe(true);

			const root = heap[0],
				extracted = extractHeapNodeMin(heap);

			expect(extracted).toBe(root);
		}
	});

	test("max heap", () => {
		const heap = [];

		for (let i = 0; i < 15; i++)
			insertHeapNodeMax(heap, i)();

		while (heap.length) {
			expect(isValidHeapMax(heap)).toBe(true);

			const root = heap[0],
				extracted = extractHeapNodeMax(heap);

			expect(extracted).toBe(root);
		}
	});
});
