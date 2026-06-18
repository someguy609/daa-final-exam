import { runCBS } from '../algorithms/cbs/cbs';
import { generateRandomScenario } from '../simulation/generators/generator';
import type { AlgorithmType } from '../simulation/models/types';

self.onmessage = (e: MessageEvent) => {
	const { type, payload } = e.data;

	if (type === 'PLAN_SINGLE') {
		const { grid, robots, docks, robotGoals, algorithm, timeoutMs } = payload;
		try {
			const result = runCBS(grid, robots, docks, robotGoals, algorithm, timeoutMs);
			self.postMessage({ type: 'PLAN_SINGLE_RESULT', payload: result });
		} catch (err: any) {
			self.postMessage({
				type: 'PLAN_SINGLE_RESULT',
				payload: {
					algorithm,
					success: false,
					paths: {},
					searchMetrics: { runtimeMs: 0, expandedNodes: 0, generatedNodes: 0, peakFrontierSize: 0 },
					cbsMetrics: { cbsConstraints: 0, cbsCTNodes: 0, conflictCount: 0 },
					solutionMetrics: { totalCost: 0, makespan: 0, totalDistance: 0, itemsCollected: 0 },
					errorMessage: err.message || 'Unknown error'
				}
			});
		}
	} else if (type === 'RUN_BENCHMARK') {
		const { scenarios, obstacleDensity, costVariance, seed, timeoutMs } = payload;

		for (let idx = 0; idx < scenarios.length; idx++) {
			const sc = scenarios[idx];

			// 1. Generate scenario once for this benchmark sweep configuration
			let generated = null;
			let genError: string | undefined;
			try {
				generated = generateRandomScenario(
					sc.gridSize,
					sc.gridSize,
					obstacleDensity,
					costVariance,
					sc.robotCount,
					sc.itemCount,
					seed + '_' + sc.id
				);
			} catch (err: any) {
				genError = err.message || 'Generation failed';
			}

			const results: Record<string, any> = {};
			const algs: AlgorithmType[] = ['gbfs', 'dijkstra', 'astar'];

			for (const alg of algs) {
				if (!generated) {
					results[alg] = {
						success: false,
						runtimeMs: 0,
						expandedNodes: 0,
						cbsCTNodes: 0,
						totalCost: 0,
						makespan: 0,
						error: genError || 'Scenario generation failed'
					};
					continue;
				}

				try {
					const res = runCBS(
						generated.grid,
						generated.robots,
						generated.docks,
						generated.robotGoals,
						alg,
						timeoutMs
					);
					results[alg] = {
						success: res.success,
						runtimeMs: res.searchMetrics.runtimeMs,
						expandedNodes: res.searchMetrics.expandedNodes,
						cbsCTNodes: res.cbsMetrics.cbsCTNodes,
						totalCost: res.solutionMetrics.totalCost,
						makespan: res.solutionMetrics.makespan,
						error: res.errorMessage
					};
				} catch (err: any) {
					results[alg] = {
						success: false,
						runtimeMs: 0,
						expandedNodes: 0,
						cbsCTNodes: 0,
						totalCost: 0,
						makespan: 0,
						error: err.message || 'Algorithm crashed'
					};
				}
			}

			// Post intermediate progress for this scenario size back to the main thread
			self.postMessage({
				type: 'BENCHMARK_PROGRESS',
				payload: {
					scenarioIndex: idx,
					scenarioId: sc.id,
					gridSize: sc.gridSize,
					robotCount: sc.robotCount,
					itemCount: sc.itemCount,
					results
				}
			});
		}

		self.postMessage({ type: 'BENCHMARK_COMPLETE' });
	}
};
export {};
