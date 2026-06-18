import type { Grid, Constraint } from '../simulation/models/types';

export function isValidCell(grid: Grid, x: number, y: number): boolean {
	if (y < 0 || y >= grid.length) return false;
	if (x < 0 || x >= grid[0].length) return false;
	return !grid[y][x].isObstacle;
}

export function hasVertexConstraint(
	constraints: Constraint[],
	robotId: string,
	x: number,
	y: number,
	t: number
): boolean {
	for (let i = 0; i < constraints.length; i++) {
		const c = constraints[i];
		if (c.robotId === robotId && c.type === 'vertex' && c.x === x && c.y === y && c.t === t) {
			return true;
		}
	}
	return false;
}

export function hasEdgeConstraint(
	constraints: Constraint[],
	robotId: string,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	t: number
): boolean {
	for (let i = 0; i < constraints.length; i++) {
		const c = constraints[i];
		if (
			c.robotId === robotId &&
			c.type === 'edge' &&
			c.fromX === fromX &&
			c.fromY === fromY &&
			c.toX === toX &&
			c.toY === toY &&
			c.t === t
		) {
			return true;
		}
	}
	return false;
}

export function hasConstraintAtOrAfter(
	constraints: Constraint[],
	robotId: string,
	x: number,
	y: number,
	t: number
): boolean {
	for (let i = 0; i < constraints.length; i++) {
		const c = constraints[i];
		// If it's a vertex constraint on this cell at or after t
		if (c.robotId === robotId && c.x === x && c.y === y && c.t >= t) {
			return true;
		}
	}
	return false;
}

export function getMaxConstraintTime(constraints: Constraint[], robotId: string): number {
	let maxT = 0;
	for (let i = 0; i < constraints.length; i++) {
		const c = constraints[i];
		if (c.robotId === robotId && c.t > maxT) {
			maxT = c.t;
		}
	}
	return maxT;
}
