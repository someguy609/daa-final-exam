export class SeededRandom {
	private nextNext: () => number;

	constructor(seedStr: string) {
		let h1 = 1779033703;
		let h2 = 3024733165;
		let h3 = 336245363;
		let h4 = 50249225;

		for (let i = 0; i < seedStr.length; i++) {
			const k = seedStr.charCodeAt(i);
			h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
			h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
			h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
			h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
		}

		h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
		h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
		h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
		h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

		let seed = (h1 ^ h2 ^ h3 ^ h4) >>> 0;

		this.nextNext = () => {
			let t = (seed += 0x6d2b79f5);
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// Returns a float in [0, 1)
	next(): number {
		return this.nextNext();
	}

	// Returns an integer in [min, max] (inclusive)
	nextInt(min: number, max: number): number {
		return min + Math.floor(this.next() * (max - min + 1));
	}

	// Returns a shuffled copy of the array
	shuffle<T>(array: T[]): T[] {
		const copy = [...array];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = this.nextInt(0, i);
			const temp = copy[i];
			copy[i] = copy[j];
			copy[j] = temp;
		}
		return copy;
	}
}
