import type { Grid, Cell, Robot, Dock, Item, Position } from '../models/types';
import { SeededRandom } from '../../utils/random';
import { validateScenarioReachability } from '../validators/validator';

const ROBOT_COLORS = [
	'#ef4444', // Red
	'#3b82f6', // Blue
	'#10b981', // Green
	'#f59e0b', // Amber
	'#8b5cf6', // Purple
	'#ec4899', // Pink
	'#06b6d4', // Cyan
	'#14b8a6', // Teal
	'#f97316', // Orange
	'#a855f7', // Light Purple
	'#6366f1', // Indigo
	'#84cc16'  // Lime
];

function getRobotColor(index: number): string {
	return ROBOT_COLORS[index % ROBOT_COLORS.length];
}

export const BIZARRE_NAMES = [
	'Barnaby',
	'Grizelda',
	'Bartholomew',
	'Wilhelmina',
	'Ichabod',
	'Archibald',
	'Hortense',
	'Ebenezer',
	'Gertrude',
	'Zenobia',
	'Ignatius',
	'Prudence',
	'Thaddeus',
	'Aloysius',
	'Euphrosyne',
	'Obadiah',
	'Petronilla',
	'Zephaniah',
	'Cuthbert',
	'Mildred'
];

export interface GeneratedScenario {
	grid: Grid;
	robots: Robot[];
	docks: Record<string, Dock>;
	items: Item[];
	robotGoals: Record<string, Position[]>; // robotId -> ordered goal Positions (items + return dock)
	seedUsed: string;
}

export function generateWarehouseGrid(
	width: number,
	height: number,
	obstacleDensity: number,
	costVariance: number,
	random: SeededRandom
): Grid {
	const grid: Grid = [];
	for (let y = 0; y < height; y++) {
		const row: Cell[] = [];
		for (let x = 0; x < width; x++) {
			const isObstacle = random.next() < obstacleDensity;
			const cost = 1 + Math.round(random.next() * 9 * costVariance);
			row.push({
				x,
				y,
				cost: Math.max(1, Math.min(10, cost)),
				isObstacle
			});
		}
		grid.push(row);
	}
	return grid;
}

export function generateRandomScenario(
	width: number,
	height: number,
	obstacleDensity: number,
	costVariance: number,
	robotCount: number,
	itemCount: number,
	seed: string
): GeneratedScenario {
	let attempt = 0;
	let currentSeed = seed;

	while (attempt < 100) {
		const random = new SeededRandom(currentSeed);
		const grid = generateWarehouseGrid(width, height, obstacleDensity, costVariance, random);

		// Find connected components of traversable cells using BFS (O(W*H))
		const visited = new Set<string>();
		const components: Position[][] = [];
		const dx = [0, 1, 0, -1];
		const dy = [-1, 0, 1, 0];

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (grid[y][x].isObstacle) continue;
				const key = `${x},${y}`;
				if (visited.has(key)) continue;

				const component: Position[] = [];
				const queue: Position[] = [{ x, y }];
				visited.add(key);
				let head = 0;

				while (head < queue.length) {
					const curr = queue[head++];
					component.push(curr);

					for (let i = 0; i < 4; i++) {
						const nx = curr.x + dx[i];
						const ny = curr.y + dy[i];

						if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
							if (!grid[ny][nx].isObstacle) {
								const nKey = `${nx},${ny}`;
								if (!visited.has(nKey)) {
									visited.add(nKey);
									queue.push({ x: nx, y: ny });
								}
							}
						}
					}
				}
				components.push(component);
			}
		}

		if (components.length === 0) {
			currentSeed = seed + '_retry_' + attempt;
			attempt++;
			continue;
		}

		// Sort components by size descending
		components.sort((a, b) => b.length - a.length);
		const largestComponent = components[0];

		// Check if we have enough traversable cells in the largest component for docks + items
		if (largestComponent.length < robotCount + itemCount) {
			// Not enough space in the largest connected component, adjust seed and retry
			currentSeed = seed + '_retry_' + attempt;
			attempt++;
			continue;
		}

		// Shuffle the cells of the largest component to select random positions
		const shuffledCells = random.shuffle(largestComponent);

		// Docks and Robots placement
		const robots: Robot[] = [];
		const docks: Record<string, Dock> = {};
		for (let i = 0; i < robotCount; i++) {
			const cell = shuffledCells[i];
			const robotId = `R${i + 1}`;
			const robotName = BIZARRE_NAMES[i % BIZARRE_NAMES.length];
			const dockId = `D${i + 1}`;

			robots.push({
				id: robotId,
				name: robotName,
				color: getRobotColor(i),
				dockId
			});

			docks[dockId] = {
				id: dockId,
				robotId,
				x: cell.x,
				y: cell.y
			};

			// Ensure dock cell itself is never an obstacle (already traversable) and reset its cost to standard if needed?
			// The spec says: "Before owner returns: Dock behaves as ordinary traversable terrain."
			// And: "Items cannot be on docks. Robots always start on their dock."
		}

		// Items placement
		const items: Item[] = [];
		for (let i = 0; i < itemCount; i++) {
			const cell = shuffledCells[robotCount + i];
			items.push({
				id: `I${i + 1}`,
				name: `Crate ${i + 1}`,
				x: cell.x,
				y: cell.y,
				assignedRobotId: null,
				collected: false
			});
		}

		// Balanced random assignment of items to robots
		// Shuffle items first
		const shuffledItems = random.shuffle(items);
		for (let i = 0; i < shuffledItems.length; i++) {
			const robotIndex = i % robotCount;
			shuffledItems[i].assignedRobotId = robots[robotIndex].id;
		}

		// Compute item ordering for each robot: Nearest Neighbor
		const robotGoals: Record<string, Position[]> = {};
		for (const robot of robots) {
			const dock = docks[robot.dockId];
			const assignedItems = items.filter((item) => item.assignedRobotId === robot.id);

			const orderedGoals: Position[] = [];
			let currentPos: Position = { x: dock.x, y: dock.y };
			const unvisited = [...assignedItems];

			while (unvisited.length > 0) {
				let nearestIdx = 0;
				let minDist = Infinity;

				for (let i = 0; i < unvisited.length; i++) {
					const item = unvisited[i];
					const dist = Math.abs(currentPos.x - item.x) + Math.abs(currentPos.y - item.y);
					if (dist < minDist) {
						minDist = dist;
						nearestIdx = i;
					} else if (dist === minDist) {
						// Tie breaker using item ID
						if (item.id < unvisited[nearestIdx].id) {
							nearestIdx = i;
						}
					}
				}

				const nextItem = unvisited.splice(nearestIdx, 1)[0];
				orderedGoals.push({ x: nextItem.x, y: nextItem.y });
				currentPos = { x: nextItem.x, y: nextItem.y };
			}

			// Finally return to the dock
			orderedGoals.push({ x: dock.x, y: dock.y });
			robotGoals[robot.id] = orderedGoals;
		}

		// Validate reachability
		if (validateScenarioReachability(grid, robots, docks, robotGoals)) {
			return {
				grid,
				robots,
				docks,
				items,
				robotGoals,
				seedUsed: currentSeed
			};
		}

		// If invalid, try next seed
		currentSeed = seed + '_retry_' + attempt;
		attempt++;
	}

	throw new Error(`Failed to generate a valid reachable scenario after 100 attempts with seed ${seed}`);
}
