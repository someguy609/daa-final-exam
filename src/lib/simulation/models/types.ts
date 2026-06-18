export interface Position {
	x: number;
	y: number;
}

export interface PathStep extends Position {
	t: number;
}

export interface Cell extends Position {
	cost: number; // 1-10
	isObstacle: boolean; // shelves
}

export type Grid = Cell[][];

export interface Robot {
	id: string;
	name: string;
	color: string;
	dockId: string; // ID of the dock it owns
}

export interface Dock extends Position {
	id: string;
	robotId: string; // ID of the robot owning this dock
}

export interface Item extends Position {
	id: string;
	name: string;
	assignedRobotId: string | null;
	collected: boolean;
}

export type Path = PathStep[];

export interface VertexConflict {
	type: 'vertex';
	x: number;
	y: number;
	t: number;
	robotA: string;
	robotB: string;
}

export interface EdgeConflict {
	type: 'edge';
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	t: number;
	robotA: string;
	robotB: string;
}

export type Conflict = VertexConflict | EdgeConflict;

export interface Constraint {
	robotId: string;
	type: 'vertex' | 'edge';
	x: number;
	y: number;
	t: number;
	fromX?: number; // only for edge constraint
	fromY?: number; // only for edge constraint
	toX?: number;   // only for edge constraint
	toY?: number;   // only for edge constraint
}

export type AlgorithmType = 'gbfs' | 'dijkstra' | 'astar';

export interface SearchMetrics {
	runtimeMs: number;
	expandedNodes: number;
	generatedNodes: number;
	peakFrontierSize: number;
}

export interface CBSMetrics {
	cbsConstraints: number;
	cbsCTNodes: number;
	conflictCount: number;
}

export interface SolutionMetrics {
	totalCost: number; // Sum of Costs (SOC)
	makespan: number;  // maximum path length
	totalDistance: number; // total steps taken (excluding waits)
	itemsCollected: number;
}

export interface AlgorithmResult {
	algorithm: AlgorithmType;
	success: boolean;
	paths: Record<string, Path>; // robotId -> Path
	searchMetrics: SearchMetrics;
	cbsMetrics: CBSMetrics;
	solutionMetrics: SolutionMetrics;
	errorMessage?: string;
}

export interface BenchmarkSweepScenario {
	id: string;
	gridSize: number; // e.g. 20 for 20x20
	robotCount: number;
	itemCount: number;
}

export interface BenchmarkSweepResult {
	scenarioId: string;
	gridSize: number;
	robotCount: number;
	itemCount: number;
	results: Record<AlgorithmType, {
		success: boolean;
		runtimeMs: number;
		expandedNodes: number;
		cbsCTNodes: number;
		totalCost: number;
		makespan: number;
		error?: string;
	}>;
}
