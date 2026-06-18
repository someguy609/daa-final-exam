import type {
	Grid,
	Constraint,
	Path,
	Position,
	Conflict,
	AlgorithmType,
	AlgorithmResult,
	SearchMetrics,
	CBSMetrics,
	SolutionMetrics
} from '../../simulation/models/types';
import { findGBFSPath } from '../gbfs/gbfs';
import { findDijkstraPath } from '../dijkstra/dijkstra';
import { findAStarPath } from '../astar/astar';
import { MinHeap } from '../../utils/heap';

interface CTNode {
	id: string;
	constraints: Constraint[];
	paths: Record<string, Path>;
	cost: number;
}

// Calculates cost of a single path: sum of destination cell costs (excluding waits)
function getPathCost(path: Path, grid: Grid): number {
	let cost = 0;
	for (let i = 1; i < path.length; i++) {
		const prev = path[i - 1];
		const curr = path[i];
		if (prev.x === curr.x && prev.y === curr.y) {
			// Wait has 0 cost
			continue;
		}
		cost += grid[curr.y][curr.x].cost;
	}
	return cost;
}

// Counts cells moved excluding waits
function getPathDistance(path: Path): number {
	let dist = 0;
	for (let i = 1; i < path.length; i++) {
		const prev = path[i - 1];
		const curr = path[i];
		if (prev.x !== curr.x || prev.y !== curr.y) {
			dist++;
		}
	}
	return dist;
}

// Plans paths for a single robot across all its goals sequentially
function planRobotPath(
	grid: Grid,
	robotId: string,
	dock: Position,
	goals: Position[],
	constraints: Constraint[],
	algorithm: AlgorithmType,
	otherPaths?: Record<string, Path>
): { path: Path; expanded: number; generated: number; peakFrontier: number } | null {
	let currentStart = dock;
	let currentTime = 0;
	const segmentPaths: Path[] = [];
	let totalExpanded = 0;
	let totalGenerated = 0;
	let maxPeakFrontier = 0;

	for (let i = 0; i < goals.length; i++) {
		const goal = goals[i];
		const isFinal = i === goals.length - 1;

		let res = null;
		if (algorithm === 'gbfs') {
			res = findGBFSPath(grid, robotId, currentStart, goal, currentTime, constraints, isFinal, otherPaths);
		} else if (algorithm === 'dijkstra') {
			res = findDijkstraPath(grid, robotId, currentStart, goal, currentTime, constraints, isFinal, otherPaths);
		} else {
			res = findAStarPath(grid, robotId, currentStart, goal, currentTime, constraints, isFinal, otherPaths);
		}

		if (!res) return null; // Unsolvable segment

		segmentPaths.push(res.path);
		totalExpanded += res.expandedNodes;
		totalGenerated += res.generatedNodes;
		maxPeakFrontier = Math.max(maxPeakFrontier, res.peakFrontierSize);

		// Next segment starts at arrival time of previous segment
		currentTime = res.path[res.path.length - 1].t;
		currentStart = goal;
	}

	// Concatenate paths (avoid duplicating boundary points)
	const fullPath: Path = [];
	for (let i = 0; i < segmentPaths.length; i++) {
		if (i === 0) {
			fullPath.push(...segmentPaths[i]);
		} else {
			fullPath.push(...segmentPaths[i].slice(1));
		}
	}

	return {
		path: fullPath,
		expanded: totalExpanded,
		generated: totalGenerated,
		peakFrontier: maxPeakFrontier
	};
}

// Detects vertex and edge conflicts across all robot paths
function detectConflict(paths: Record<string, Path>): Conflict | null {
	const robotIds = Object.keys(paths);
	if (robotIds.length === 0) return null;

	const pathLengths = robotIds.map((id) => paths[id].length);
	const maxT = Math.max(...pathLengths, 0);

	for (let t = 0; t <= maxT; t++) {
		// 1. Get positions at time t
		const positions: Record<string, Position> = {};
		for (const id of robotIds) {
			const path = paths[id];
			if (t < path.length) {
				positions[id] = path[t];
			} else {
				// Finished robot remains permanently at its dock
				positions[id] = path[path.length - 1];
			}
		}

		// 2. Vertex Conflict Check
		for (let i = 0; i < robotIds.length; i++) {
			const idA = robotIds[i];
			const posA = positions[idA];
			for (let j = i + 1; j < robotIds.length; j++) {
				const idB = robotIds[j];
				const posB = positions[idB];
				if (posA.x === posB.x && posA.y === posB.y) {
					return {
						type: 'vertex',
						x: posA.x,
						y: posA.y,
						t,
						robotA: idA,
						robotB: idB
					};
				}
			}
		}

		// 3. Edge Conflict Check (only when both robots are active at t -> t+1)
		for (let i = 0; i < robotIds.length; i++) {
			const idA = robotIds[i];
			const pathA = paths[idA];
			if (t >= pathA.length - 1) continue;
			const fromA = pathA[t];
			const toA = pathA[t + 1];

			for (let j = i + 1; j < robotIds.length; j++) {
				const idB = robotIds[j];
				const pathB = paths[idB];
				if (t >= pathB.length - 1) continue;
				const fromB = pathB[t];
				const toB = pathB[t + 1];

				if (
					fromA.x === toB.x &&
					fromA.y === toB.y &&
					toA.x === fromB.x &&
					toA.y === fromB.y
				) {
					return {
						type: 'edge',
						fromX: fromA.x,
						fromY: fromA.y,
						toX: toA.x,
						toY: toA.y,
						t,
						robotA: idA,
						robotB: idB
					};
				}
			}
		}
	}

	return null;
}

export function runCBS(
	grid: Grid,
	robots: { id: string; dockId: string; color: string }[],
	docks: Record<string, Position>,
	robotGoals: Record<string, Position[]>, // robotId -> list of goal Positions in order
	algorithm: AlgorithmType,
	timeoutMs = 10000
): AlgorithmResult {
	const startTimeMs = performance.now();

	let lowLevelExpanded = 0;
	let lowLevelGenerated = 0;
	let peakFrontierSize = 0;

	let cbsCTNodes = 0;
	let conflictCount = 0;

	const resultTemplate = (success: boolean, paths: Record<string, Path>, errMsg?: string): AlgorithmResult => {
		const duration = performance.now() - startTimeMs;

		let totalCost = 0;
		let makespan = 0;
		let totalDistance = 0;
		if (success) {
			for (const rId of Object.keys(paths)) {
				totalCost += getPathCost(paths[rId], grid);
				makespan = Math.max(makespan, paths[rId].length - 1);
				totalDistance += getPathDistance(paths[rId]);
			}
		}

		return {
			algorithm,
			success,
			paths,
			searchMetrics: {
				runtimeMs: Math.round(duration),
				expandedNodes: lowLevelExpanded,
				generatedNodes: lowLevelGenerated,
				peakFrontierSize
			},
			cbsMetrics: {
				cbsConstraints: success ? Object.keys(paths).reduce((acc, rId) => acc, 0) : 0, // Placeholder or exact, we will calculate below
				cbsCTNodes,
				conflictCount
			},
			solutionMetrics: {
				totalCost,
				makespan: success ? makespan : 0,
				totalDistance: success ? totalDistance : 0,
				itemsCollected: success ? Object.values(robotGoals).reduce((acc, list) => acc + Math.max(0, list.length - 1), 0) : 0 // exclude return-to-dock goal
			},
			errorMessage: errMsg
		};
	};

	// Initialize Root Node
	const rootConstraints: Constraint[] = [];
	const rootPaths: Record<string, Path> = {};

	for (const robot of robots) {
		const goals = robotGoals[robot.id] || [];
		const dock = docks[robot.dockId];
		if (!dock) {
			return resultTemplate(false, {}, `Dock not found for robot ${robot.id}`);
		}

		const res = planRobotPath(grid, robot.id, dock, goals, rootConstraints, algorithm, rootPaths);
		if (!res) {
			return resultTemplate(false, {}, `Unsolvable: Start pathfinding failed for robot ${robot.id}`);
		}

		rootPaths[robot.id] = res.path;
		lowLevelExpanded += res.expanded;
		lowLevelGenerated += res.generated;
		peakFrontierSize = Math.max(peakFrontierSize, res.peakFrontier);
	}

	const rootCost = Object.keys(rootPaths).reduce((acc, rId) => acc + getPathCost(rootPaths[rId], grid), 0);

	const rootNode: CTNode = {
		id: '0',
		constraints: rootConstraints,
		paths: rootPaths,
		cost: rootCost
	};

	const heap = new MinHeap<CTNode>();
	heap.push(rootNode, rootCost);
	cbsCTNodes++;

	let nodeCounter = 1;

	while (!heap.isEmpty()) {
		// Timeout check
		if (performance.now() - startTimeMs > timeoutMs) {
			return resultTemplate(false, {}, `CBS search timed out after ${timeoutMs}ms`);
		}

		// Safety node limit check to prevent OOM on conflict cascades
		if (cbsCTNodes > 1000) {
			return resultTemplate(false, {}, `CBS CT node limit exceeded (${cbsCTNodes} nodes)`);
		}

		const currNode = heap.pop()!;

		// Check for conflicts
		const conflict = detectConflict(currNode.paths);
		if (!conflict) {
			// Collision-free solution found!
			const finalResult = resultTemplate(true, currNode.paths);
			finalResult.cbsMetrics.cbsConstraints = currNode.constraints.length;
			finalResult.cbsMetrics.cbsCTNodes = cbsCTNodes;
			finalResult.cbsMetrics.conflictCount = conflictCount;
			return finalResult;
		}

		conflictCount++;

		// Branch by creating two children
		const robotA = conflict.robotA;
		const robotB = conflict.robotB;

		const constraintsA: Constraint[] = [];
		const constraintsB: Constraint[] = [];

		if (conflict.type === 'vertex') {
			// Vertex constraint
			constraintsA.push({
				robotId: robotA,
				type: 'vertex',
				x: conflict.x,
				y: conflict.y,
				t: conflict.t
			});
			constraintsB.push({
				robotId: robotB,
				type: 'vertex',
				x: conflict.x,
				y: conflict.y,
				t: conflict.t
			});
		} else {
			// Edge constraint
			constraintsA.push({
				robotId: robotA,
				type: 'edge',
				x: conflict.toX, // target coordinates
				y: conflict.toY,
				t: conflict.t,
				fromX: conflict.fromX,
				fromY: conflict.fromY,
				toX: conflict.toX,
				toY: conflict.toY
			});
			constraintsB.push({
				robotId: robotB,
				type: 'edge',
				x: conflict.fromX, // inverse coordinates for the other robot
				y: conflict.fromY,
				t: conflict.t,
				fromX: conflict.toX,
				fromY: conflict.toY,
				toX: conflict.fromX,
				toY: conflict.fromY
			});
		}

		const processChild = (targetRobot: string, newConstraint: Constraint) => {
			const childConstraints = [...currNode.constraints, newConstraint];
			const childPaths = { ...currNode.paths };

			// Re-plan path only for the target robot
			const goals = robotGoals[targetRobot];
			const dock = docks[robots.find((r) => r.id === targetRobot)!.dockId];

			const res = planRobotPath(grid, targetRobot, dock, goals, childConstraints, algorithm, childPaths);
			if (res) {
				childPaths[targetRobot] = res.path;
				lowLevelExpanded += res.expanded;
				lowLevelGenerated += res.generated;
				peakFrontierSize = Math.max(peakFrontierSize, res.peakFrontier);

				const childCost = Object.keys(childPaths).reduce(
					(acc, rId) => acc + getPathCost(childPaths[rId], grid),
					0
				);

				const childNode: CTNode = {
					id: String(nodeCounter++),
					constraints: childConstraints,
					paths: childPaths,
					cost: childCost
				};

				heap.push(childNode, childCost);
				cbsCTNodes++;
			}
		};

		// Branch A
		processChild(robotA, constraintsA[0]);
		// Branch B
		processChild(robotB, constraintsB[0]);
	}

	return resultTemplate(false, {}, 'CBS search tree exhausted without finding a solution');
}
