import { writable, derived, get } from 'svelte/store';
import type {
	Grid,
	Robot,
	Dock,
	Item,
	Position,
	AlgorithmType,
	Path,
	SearchMetrics,
	CBSMetrics,
	SolutionMetrics,
	BenchmarkSweepResult,
	BenchmarkSweepScenario
} from '../simulation/models/types';
import { generateRandomScenario } from '../simulation/generators/generator';

// Writable Stores
export const gridStore = writable<Grid>([]);
export const robotsStore = writable<Robot[]>([]);
export const docksStore = writable<Record<string, Dock>>({});
export const itemsStore = writable<Item[]>([]);
export const robotGoalsStore = writable<Record<string, Position[]>>({});
export const seedStore = writable<string>('cbs_warehouse');
export const selectedAlgorithmStore = writable<AlgorithmType>('astar');

export const timestepStore = writable<number>(0);
export const isPlayingStore = writable<boolean>(false);
export const playbackSpeedStore = writable<number>(1); // 0.5, 1, 2, 4

export const pathsStore = writable<Record<string, Path>>({});
export const isLoadingStore = writable<boolean>(false);
export const errorMessageStore = writable<string | null>(null);

export const searchMetricsStore = writable<SearchMetrics | null>(null);
export const cbsMetricsStore = writable<CBSMetrics | null>(null);
export const solutionMetricsStore = writable<SolutionMetrics | null>(null);

export const isBenchmarkingStore = writable<boolean>(false);
export const benchmarkProgressStore = writable<BenchmarkSweepResult[]>([]);
export const benchmarkScenariosStore = writable<BenchmarkSweepScenario[]>([
	{ id: 'S1', gridSize: 6,  robotCount: 2, itemCount: 6 },
	{ id: 'S2', gridSize: 12, robotCount: 3, itemCount: 9 },
	{ id: 'S3', gridSize: 20, robotCount: 4, itemCount: 12 },
	{ id: 'S4', gridSize: 40, robotCount: 5, itemCount: 15 },
	{ id: 'S5', gridSize: 60, robotCount: 6, itemCount: 18 }
]);

export const screenshotTriggerStore = writable<(() => void) | null>(null);

// Derived Stores
export const makespanStore = derived(pathsStore, ($paths) => {
	const lengths = Object.values($paths).map((p) => p.length);
	return lengths.length > 0 ? Math.max(...lengths) - 1 : 0;
});

// Dynamic positions of robots at current timestep
export const currentPositionsStore = derived(
	[pathsStore, timestepStore, robotsStore, docksStore],
	([$paths, $timestep, $robots, $docks]) => {
		const pos: Record<string, { x: number; y: number; finished: boolean }> = {};
		// First, set fallback positions to docks for all robots
		for (const robot of $robots) {
			const dock = $docks[robot.dockId];
			if (dock) {
				pos[robot.id] = { x: dock.x, y: dock.y, finished: false };
			}
		}
		// Override with paths if calculated
		for (const rId of Object.keys($paths)) {
			const path = $paths[rId];
			if (path && path.length > 0) {
				if ($timestep < path.length) {
					pos[rId] = { x: path[$timestep].x, y: path[$timestep].y, finished: false };
				} else {
					const last = path[path.length - 1];
					pos[rId] = { x: last.x, y: last.y, finished: true };
				}
			}
		}
		return pos;
	}
);

// Dynamic item collection states computed reactively
export const collectedItemsStore = derived(
	[itemsStore, pathsStore, timestepStore],
	([$items, $paths, $timestep]) => {
		return $items.map((item) => {
			if (!item.assignedRobotId) return { ...item, collected: false };
			const path = $paths[item.assignedRobotId];
			if (!path) return { ...item, collected: false };

			let collectT = -1;
			for (let t = 0; t < path.length; t++) {
				if (path[t].x === item.x && path[t].y === item.y) {
					collectT = t;
					break;
				}
			}

			const collected = collectT !== -1 && collectT <= $timestep;
			return { ...item, collected };
		});
	}
);

// Web Worker instance manager
let worker: Worker | null = null;

function getWorker(): Worker {
	if (!worker) {
		// Vite module worker loading format
		worker = new Worker(new URL('../utils/pathfinding.worker.ts', import.meta.url), {
			type: 'module'
		});
	}
	return worker;
}

// Generate scenario helper
export function generateScenario(
	width: number,
	height: number,
	obstacleDensity: number,
	costVariance: number,
	robotCount: number,
	itemCount: number,
	seed: string
) {
	try {
		errorMessageStore.set(null);
		const sc = generateRandomScenario(
			width,
			height,
			obstacleDensity,
			costVariance,
			robotCount,
			itemCount,
			seed
		);

		gridStore.set(sc.grid);
		robotsStore.set(sc.robots);
		docksStore.set(sc.docks);
		itemsStore.set(sc.items);
		robotGoalsStore.set(sc.robotGoals);
		seedStore.set(sc.seedUsed);

		// Clear prior paths and metrics
		pathsStore.set({});
		searchMetricsStore.set(null);
		cbsMetricsStore.set(null);
		solutionMetricsStore.set(null);
		timestepStore.set(0);
		isPlayingStore.set(false);
	} catch (err: any) {
		errorMessageStore.set(err.message || 'Failed to generate scenario');
	}
}

// Re-plans path based on current store settings
export function runPathfinding() {
	const grid = get(gridStore);
	const robots = get(robotsStore);
	const docks = get(docksStore);
	const robotGoals = get(robotGoalsStore);
	const algorithm = get(selectedAlgorithmStore);

	if (robots.length === 0) return;

	isLoadingStore.set(true);
	errorMessageStore.set(null);

	const w = getWorker();
	w.onmessage = (e) => {
		const { type, payload } = e.data;
		if (type === 'PLAN_SINGLE_RESULT') {
			const res = payload;
			isLoadingStore.set(false);
			if (res.success) {
				pathsStore.set(res.paths);
				searchMetricsStore.set(res.searchMetrics);
				cbsMetricsStore.set(res.cbsMetrics);
				solutionMetricsStore.set(res.solutionMetrics);
				timestepStore.set(0);
			} else {
				pathsStore.set({});
				errorMessageStore.set(res.errorMessage || 'Pathfinding failed');
				searchMetricsStore.set(res.searchMetrics);
				cbsMetricsStore.set(res.cbsMetrics);
				solutionMetricsStore.set(null);
			}
		}
	};

	w.postMessage({
		type: 'PLAN_SINGLE',
		payload: {
			grid,
			robots,
			docks,
			robotGoals,
			algorithm,
			timeoutMs: 25000 // 25s timeout for large path planning
		}
	});
}

// Runs benchmark sweep
export function startBenchmarkSweep(
	obstacleDensity: number,
	costVariance: number,
	seed: string
) {
	isBenchmarkingStore.set(true);
	benchmarkProgressStore.set([]);

	const sweepScenarios = get(benchmarkScenariosStore);

	const w = getWorker();
	w.onmessage = (e) => {
		const { type, payload } = e.data;
		if (type === 'BENCHMARK_PROGRESS') {
			benchmarkProgressStore.update((arr) => [...arr, payload]);
		} else if (type === 'BENCHMARK_COMPLETE') {
			isBenchmarkingStore.set(false);
		}
	};

	w.postMessage({
		type: 'RUN_BENCHMARK',
		payload: {
			scenarios: sweepScenarios,
			obstacleDensity,
			costVariance,
			seed,
			timeoutMs: 10000 // 10s per algorithm run to protect thread
		}
	});
}

// Playback actions
export function startPlayback() {
	isPlayingStore.set(true);
}

export function pausePlayback() {
	isPlayingStore.set(false);
}

export function stepForward() {
	const t = get(timestepStore);
	const maxT = get(makespanStore);
	if (t < maxT) {
		timestepStore.set(t + 1);
	}
}

export function stepBackward() {
	const t = get(timestepStore);
	if (t > 0) {
		timestepStore.set(t - 1);
	}
}

export function resetPlayback() {
	timestepStore.set(0);
	isPlayingStore.set(false);
}

// Internal playback loop
let playbackInterval: any = null;

isPlayingStore.subscribe((playing) => {
	if (playbackInterval) {
		clearInterval(playbackInterval);
		playbackInterval = null;
	}

	if (playing) {
		const runInterval = () => {
			const speed = get(playbackSpeedStore);
			const intervalMs = 300 / speed; // 1x = 300ms per step, faster for responsiveness

			playbackInterval = setInterval(() => {
				const t = get(timestepStore);
				const maxT = get(makespanStore);
				if (t < maxT) {
					timestepStore.set(t + 1);
				} else {
					isPlayingStore.set(false);
				}
			}, intervalMs);
		};
		runInterval();
	}
});

// Update playback interval on speed changes
playbackSpeedStore.subscribe(() => {
	const playing = get(isPlayingStore);
	if (playing) {
		if (playbackInterval) {
			clearInterval(playbackInterval);
			playbackInterval = null;
		}
		const speed = get(playbackSpeedStore);
		const intervalMs = 300 / speed;
		playbackInterval = setInterval(() => {
			const t = get(timestepStore);
			const maxT = get(makespanStore);
			if (t < maxT) {
				timestepStore.set(t + 1);
			} else {
				isPlayingStore.set(false);
			}
		}, intervalMs);
	}
});

export function recomputeRobotGoals() {
	const robots = get(robotsStore);
	const docks = get(docksStore);
	const items = get(itemsStore);

	const robotGoals: Record<string, Position[]> = {};
	for (const robot of robots) {
		const dock = docks[robot.dockId];
		if (!dock) continue;

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
	robotGoalsStore.set(robotGoals);
}

export function assignItemRobot(itemId: string, robotId: string | null) {
	itemsStore.update((items) => {
		return items.map((item) => {
			if (item.id === itemId) {
				return { ...item, assignedRobotId: robotId };
			}
			return item;
		});
	});
	recomputeRobotGoals();
	pathsStore.set({}); // Clear old paths since goals changed
}

