import { generateRandomScenario } from '../src/lib/simulation/generators/generator';
import { runCBS } from '../src/lib/algorithms/cbs/cbs';
import type { AlgorithmType } from '../src/lib/simulation/models/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All five scenarios use the SAME obstacle density (15%) and cost variance (50%).
const SCENARIOS = [
	{ id: 'S1', name: 'Scenario 1 (6×6)',   gridSize: 6,  robotCount: 2, itemCount: 6 },
	{ id: 'S2', name: 'Scenario 2 (12×12)', gridSize: 12, robotCount: 3, itemCount: 9 },
	{ id: 'S3', name: 'Scenario 3 (20×20)', gridSize: 20, robotCount: 4, itemCount: 12 },
	{ id: 'S4', name: 'Scenario 4 (40×40)', gridSize: 40, robotCount: 5, itemCount: 15 },
	{ id: 'S5', name: 'Scenario 5 (60×60)', gridSize: 60, robotCount: 6, itemCount: 18 }
];


const ALGORITHMS: { type: AlgorithmType; label: string }[] = [
	{ type: 'gbfs',     label: 'GBFS + CBS'     },
	{ type: 'dijkstra', label: 'Dijkstra + CBS'  },
	{ type: 'astar',    label: 'A* + CBS'        }
];

const density   = 0.15;   // 15% obstacle density — uniform across all scenarios
const variance  = 0.50;   // 50% cost variance   — uniform across all scenarios
const SEEDS     = ["uUDcAX6i","uKCWFcxa","ZMavqjIt","BEq3TaWN","wBhJq9MW"];
const timeoutMs = 30000;  // 30 s per algorithm run

function getStats(vals: number[]): { mean: number; std: number } {
	if (vals.length === 0) return { mean: 0, std: 0 };
	const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
	const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
	const std = Math.sqrt(variance);
	return { mean, std };
}

function formatStats(vals: number[], decimals: number = 0): string {
	if (vals.length === 0) return '0 ± 0';
	const { mean, std } = getStats(vals);
	return `${mean.toFixed(decimals)} ± ${std.toFixed(decimals)}`;
}

async function runBenchmark() {
	console.log('============================================================');
	console.log('        DAA CAPSTONE PROJECT — BENCHMARK RUNNER             ');
	console.log('============================================================');
	console.log(`Obstacle density : ${density * 100}%  (uniform, all scenarios)`);
	console.log(`Cost variance    : ${variance * 100}%  (uniform, all scenarios)`);
	console.log(`Random seeds     : ${JSON.stringify(SEEDS)}`);
	console.log(`Timeout / algo   : ${timeoutMs / 1000} s`);
	console.log('------------------------------------------------------------\n');

	const results: any[] = [];

	for (const sc of SCENARIOS) {
		const vertices = sc.gridSize * sc.gridSize;
		console.log(`▶  ${sc.name}  (vertices: ${vertices})...`);

		for (const alg of ALGORITHMS) {
			const runtimes: number[] = [];
			const nodesList: number[] = [];
			const socsList: number[] = [];
			const makespansList: number[] = [];
			let successCount = 0;
			let errors: string[] = [];

			for (const currentSeed of SEEDS) {
				let generated = null;
				let genError  = '';
				try {
					generated = generateRandomScenario(
						sc.gridSize, sc.gridSize,
						density, variance,
						sc.robotCount, sc.itemCount,
						currentSeed + '_' + sc.id
					);
				} catch (err: any) {
					genError = err.message || 'Generation failed';
				}

				if (!generated) {
					errors.push(genError || 'Generation failed');
					continue;
				}

				try {
					const t0  = performance.now();
					const res = runCBS(
						generated.grid, generated.robots,
						generated.docks, generated.robotGoals,
						alg.type, timeoutMs
					);
					const dur = performance.now() - t0;

					if (res.success) {
						runtimes.push(res.searchMetrics.runtimeMs || dur);
						nodesList.push(res.searchMetrics.expandedNodes);
						socsList.push(res.solutionMetrics.totalCost);
						makespansList.push(res.solutionMetrics.makespan);
						successCount++;
					} else {
						errors.push(res.errorMessage || 'Timeout');
					}
				} catch (err: any) {
					errors.push(err.message || 'Crashed');
				}
			}

			const displaySuccess = successCount > 0 ? (successCount === SEEDS.length ? 'Yes' : `Yes (${successCount}/${SEEDS.length})`) : 'No';
			const runtimeStr = formatStats(runtimes, 1);
			const nodesStr   = formatStats(nodesList, 0);
			const socStr     = formatStats(socsList, 0);
			const makespanStr = formatStats(makespansList, 0);
			const combinedError = errors.length > 0 ? errors.join('; ') : '';

			results.push({
				scenarioId: sc.id, name: sc.name, vertices,
				robots: sc.robotCount, items: sc.itemCount,
				obstacleDensityPct: density * 100,
				algorithm: alg.label,
				success:       displaySuccess,
				runtimeMs:     runtimeStr,
				expandedNodes: nodesStr,
				soc:           socStr,
				makespan:      makespanStr,
				error:         combinedError
			});

			if (successCount > 0) {
				console.log(
					`   ✓ ${alg.label.padEnd(15)}: ${runtimeStr} ms | ` +
					`nodes: ${nodesStr} | ` +
					`SOC: ${socStr} | ` +
					`makespan: ${makespanStr} ` +
					`(${successCount}/${SEEDS.length} seeds succeeded)`
				);
			} else {
				console.log(`   ✗ ${alg.label.padEnd(15)}: FAILED (all seeds failed/timed out: ${combinedError})`);
			}
		}
		console.log('');
	}

	// ── Console summary table ─────────────────────────────────────────────────
	const W = 125;
	console.log('='.repeat(W));
	console.log(' BENCHMARK RESULTS'.padEnd(W));
	console.log('='.repeat(W));
	const hdr = [
		'Scenario'.padEnd(20),
		'Algorithm'.padEnd(15),
		'OK'.padEnd(4),
		'ms (mean ± std)'.padStart(18),
		'Nodes (mean ± std)'.padStart(22),
		'SOC (mean ± std)'.padStart(18),
		'Makespan (mean ± std)'.padStart(22),
	].join(' | ');
	console.log(hdr);
	console.log('-'.repeat(W));
	for (const r of results) {
		console.log([
			r.name.padEnd(20),
			r.algorithm.padEnd(15),
			r.success.padEnd(4),
			String(r.runtimeMs).padStart(18),
			String(r.expandedNodes).padStart(22),
			String(r.soc).padStart(18),
			String(r.makespan).padStart(22),
		].join(' | '));
	}
	console.log('='.repeat(W) + '\n');

	// ── CSV export ────────────────────────────────────────────────────────────
	const csvHeaders = [
		'Scenario ID', 'Scenario Name', 'Grid Vertices', 'Grid Size',
		'Robots', 'Items', 'Obstacle Density (%)', 'Algorithm',
		'Success', 'Runtime (mean ± std) (ms)', 'Nodes Expanded (mean ± std)', 'Sum of Costs (mean ± std)', 'Makespan (mean ± std)', 'Error'
	];
	const csvRows = [
		csvHeaders.join(','),
		...results.map((r) => [
			r.scenarioId,
			`"${r.name}"`,
			r.vertices,
			Math.sqrt(r.vertices),
			r.robots,
			r.items,
			r.obstacleDensityPct,
			`"${r.algorithm}"`,
			r.success,
			`"${r.runtimeMs}"`,
			`"${r.expandedNodes}"`,
			`"${r.soc}"`,
			`"${r.makespan}"`,
			`"${r.error}"`
		].join(','))
	];

	const csvPath = path.resolve(__dirname, '../benchmark_results.csv');
	fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
	console.log(`CSV saved to: ${csvPath}\n`);
}

runBenchmark().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
