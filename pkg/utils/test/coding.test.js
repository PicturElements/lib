import {
	mkEncoder,
	mkDecoder
} from "../src/coding";

describe("correct functionality using ASCII encoding/decoding with bit streaming", () => {
	test("without trailing zeroes", () => {
		const srz = mkEncoder("ascii");

		srz.put([0, 0b1001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0b1110]);

		const s = srz.extract(),
			dsrz = mkDecoder("ascii");

		let s2 = "";
		dsrz.extractBitstream(s, bit => s2 += bit);

		expect(s).toBe("$\x00\x01`4");
		expect(s2).toBe("010010000000000000001110");
	});

	test("with trailing zeroes", () => {
		const srz = mkEncoder("ascii");
		
		srz.put([0, 0b1001, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0b1110000000000]);
	
		const s = srz.extract(),
			dsrz = mkDecoder("ascii");
	
		let s2 = "";
		dsrz.extractBitstream(s, bit => s2 += bit);
	
		expect(s).toBe("$\x00\x01`\x002");
		expect(s2).toBe("010010000000000000001110000000000");
	});
});
