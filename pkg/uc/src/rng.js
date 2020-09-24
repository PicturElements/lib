// Coefficients based on MT19937
const WORD_SIZE = 32,
	RECURRENCE = 624,
	MIDDLE_WORD = 397,
	SEPARATION = 31,
	TWIST = 0x9908b0df,
	T_MASK_A = 11,
	T_MASK_B = 0xffffffff,
	T_SHIFT_A = 7,
	T_SHIFT_B = 0x9d2c5680,
	T_ADD_A = 15,
	T_ADD_B = 0xefc60000,
	T_ADD_C = 18,
	F = 1812433253;

export default class RNG {
	constructor(seed = 5489, config = {}) {
		const {
			wordSize = WORD_SIZE,
			recurrence = RECURRENCE,
			middleWord = MIDDLE_WORD,
			separation = SEPARATION,
			twist = TWIST,
			tMaskA = T_MASK_A,
			tMaskB = T_MASK_B,
			tShiftA = T_SHIFT_A,
			tShiftB = T_SHIFT_B,
			tAddA = T_ADD_A,
			tAddB = T_ADD_B,
			tAddC = T_ADD_C
		} = config;

		this.seed = seed;
		this.state = [];
		this.index = 0;

		this.wordSize = wordSize;
		this.recurrence = recurrence;
		this.middleWord = middleWord;
		this.separation = separation;
		this.twist = twist;
		this.tMaskA = tMaskA;
		this.tMaskB = tMaskB;
		this.tShiftA = tShiftA;
		this.tShiftB = tShiftB;
		this.tAddA = tAddA;
		this.tAddB = tAddB;
		this.tAddC = tAddC;

		this.lowerMask = (1 << separation) - 1;
		this.upperMask = (~this.lowerMask) & ((1 < wordSize) - 1);
		this.wordMask = (1 << (wordSize - 1)) - 1;

		this.state[0] = seed;

		for (let i = 1; i < recurrence; i++)
			this.state.push((F * (this.state[i - 1] ^ (this.state[i - 1] >> (wordSize - 2))) + i) & this.wordMask);

		this._twist();
	}

	_twist() {
		const state = this.state;

		for (let i = 0, l = state.length; i < l; i++) {
			const x = (state[i] & this.upperMask) + (state[(i + 1) % l] & this.lowerMask);
			let xA = x >> 1;

			if (x % 2)
				xA ^= this.twist;

			state[i] = state[(i + this.middleWord) % l] ^ xA;
		}

		this.index = 0;
	}

	generate() {
		if (this.index >= this.recurrence)
			this._twist();

		let n = this.state[this.index++];
		n ^= (n >> this.tMaskA) & this.tMaskB;
		n ^= (n << this.tShiftA) & this.tShiftB;
		n ^= (n << this.tAddA) & this.tAddB;
		n ^= n >> this.tAddC;

		return n & this.wordMask;
	}
}
