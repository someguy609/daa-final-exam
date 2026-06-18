import type { Grid, Position } from '../models/types';

export function isPathReachable(grid: Grid, start: Position, goal: Position): boolean {
	const queue: Position[] = [start];
	const visited = new Set<string>([`${start.x},${start.y}`]);

	const dx = [0, 1, 0, -1];
	const dy = [-1, 0, 1, 0];

	let head = 0;
	while (head < queue.length) {
		const curr = queue[head++];
		if (curr.x === goal.x && curr.y === goal.y) return true;

		for (let i = 0; i < 4; i++) {
			const nx = curr.x + dx[i];
			const ny = curr.y + dy[i];

			if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
				if (!grid[ny][nx].isObstacle) {
					const key = `${nx},${ny}`;
					if (!visited.has(key)) {
						visited.add(key);
						queue.push({ x: nx, y: ny });
					}
				}
			}
		}
	}

	return false;
}

export function validateScenarioReachability(
	grid: Grid,
	robots: { id: string; dockId: string }[],
	docks: Record<string, Position>,
	robotGoals: Record<string, Position[]>
): boolean {
	for (const robot of robots) {
		const dock = docks[robot.dockId];
		if (!dock) return false;

		const goals = robotGoals[robot.id] || [];
		let currentStart = dock;
		for (const goal of goals) {
			if (!isPathReachable(grid, currentStart, goal)) {
				return false;
			}
			currentStart = goal;
		}
	}
	return true;
}
