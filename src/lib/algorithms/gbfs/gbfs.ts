import type { Grid, Constraint, Path, PathStep, Position } from '../../simulation/models/types';
import { MinHeap } from '../../utils/heap';
import {
	isValidCell,
	hasVertexConstraint,
	hasEdgeConstraint,
	hasConstraintAtOrAfter,
	getMaxConstraintTime
} from '../utils';

interface GBFSState {
	x: number;
	y: number;
	t: number;
	gCost: number;
	hCost: number;
	path: PathStep[];
}

export function findGBFSPath(
	grid: Grid,
	robotId: string,
	start: Position,
	goal: Position,
	startTime: number,
	constraints: Constraint[],
	isFinalSegment: boolean,
	otherPaths?: Record<string, Path>
): { path: Path; expandedNodes: number; generatedNodes: number; peakFrontierSize: number } | null {
	const heap = new MinHeap<GBFSState>();
	const visited = new Set<string>();

	let expandedNodes = 0;
	let generatedNodes = 0;
	let peakFrontierSize = 0;

	const maxConstraintTime = getMaxConstraintTime(constraints, robotId);
	const width = grid[0].length;
	const height = grid.length;
	const maxTimeLimit = startTime + width * height * 4 + maxConstraintTime + 50;

	function getHeuristic(x: number, y: number): number {
		return Math.abs(x - goal.x) + Math.abs(y - goal.y);
	}

	function isBlockedByFinishedRobot(nx: number, ny: number, time: number): boolean {
		if (!otherPaths) return false;
		for (const rId of Object.keys(otherPaths)) {
			if (rId === robotId) continue;
			const path = otherPaths[rId];
			if (path && path.length > 0) {
				const tFinish = path.length - 1;
				if (time >= tFinish) {
					const posFinish = path[tFinish];
					if (posFinish.x === nx && posFinish.y === ny) {
						return true;
					}
				}
			}
		}
		return false;
	}

	const initialH = getHeuristic(start.x, start.y);
	heap.push(
		{
			x: start.x,
			y: start.y,
			t: startTime,
			gCost: 0,
			hCost: initialH,
			path: [{ x: start.x, y: start.y, t: startTime }]
		},
		initialH
	);
	generatedNodes++;

	const dx = [0, 1, 0, -1];
	const dy = [-1, 0, 1, 0];

	while (!heap.isEmpty()) {
		peakFrontierSize = Math.max(peakFrontierSize, heap.size());
		const current = heap.pop()!;
		const { x, y, t, gCost, hCost, path } = current;

		const stateKey = `${x},${y},${t}`;
		if (visited.has(stateKey)) continue;
		visited.add(stateKey);
		expandedNodes++;

		// Check if we reached the goal
		if (x === goal.x && y === goal.y) {
			if (!isFinalSegment || !hasConstraintAtOrAfter(constraints, robotId, x, y, t)) {
				return {
					path,
					expandedNodes,
					generatedNodes,
					peakFrontierSize
				};
			}
		}

		if (t >= maxTimeLimit) continue;

		// 1. Try moving to neighbors
		for (let i = 0; i < 4; i++) {
			const nx = x + dx[i];
			const ny = y + dy[i];
			const nextT = t + 1;

			if (isValidCell(grid, nx, ny)) {
				if (
					!hasVertexConstraint(constraints, robotId, nx, ny, nextT) &&
					!hasEdgeConstraint(constraints, robotId, x, y, nx, ny, t) &&
					!isBlockedByFinishedRobot(nx, ny, nextT)
				) {
					const nextGCost = gCost + grid[ny][nx].cost;
					const nextH = getHeuristic(nx, ny);
					const nextPath = [...path, { x: nx, y: ny, t: nextT }];

					generatedNodes++;
					// Priority is h(n) in GBFS
					heap.push(
						{
							x: nx,
							y: ny,
							t: nextT,
							gCost: nextGCost,
							hCost: nextH,
							path: nextPath
						},
						nextH
					);
				}
			}
		}

		// 2. Try waiting
		if (t <= maxConstraintTime) {
			const nextT = t + 1;
			if (!hasVertexConstraint(constraints, robotId, x, y, nextT) && !isBlockedByFinishedRobot(x, y, nextT)) {
				const nextH = getHeuristic(x, y);
				const nextPath = [...path, { x, y, t: nextT }];
				generatedNodes++;
				heap.push(
					{
						x,
						y,
						t: nextT,
						gCost: gCost,
						hCost: nextH,
						path: nextPath
					},
					nextH
				);
			}
		}
	}

	return null;
}
