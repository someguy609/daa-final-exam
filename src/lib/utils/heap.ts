export class MinHeap<T> {
	private heap: { score: number; element: T }[] = [];

	push(element: T, score: number) {
		this.heap.push({ score, element });
		this.up(this.heap.length - 1);
	}

	pop(): T | null {
		if (this.heap.length === 0) return null;
		const top = this.heap[0].element;
		const bottom = this.heap.pop()!;
		if (this.heap.length > 0) {
			this.heap[0] = bottom;
			this.down(0);
		}
		return top;
	}

	size(): number {
		return this.heap.length;
	}

	isEmpty(): boolean {
		return this.heap.length === 0;
	}

	private up(index: number) {
		while (index > 0) {
			const parent = (index - 1) >> 1;
			if (this.heap[parent].score <= this.heap[index].score) break;
			const temp = this.heap[parent];
			this.heap[parent] = this.heap[index];
			this.heap[index] = temp;
			index = parent;
		}
	}

	private down(index: number) {
		const length = this.heap.length;
		const current = this.heap[index];
		while (true) {
			const left = (index << 1) + 1;
			const right = left + 1;
			let smallest = index;
			if (left < length && this.heap[left].score < this.heap[smallest].score) {
				smallest = left;
			}
			if (right < length && this.heap[right].score < this.heap[smallest].score) {
				smallest = right;
			}
			if (smallest === index) break;
			this.heap[index] = this.heap[smallest];
			this.heap[smallest] = current;
			index = smallest;
		}
	}
}
