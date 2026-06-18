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
	{ id: 'S4', name: 'Scenario 4 (32×32)', gridSize: 32, robotCount: 5, itemCount: 15 },
	{ id: 'S5', name: 'Scenario 5 (45×45)', gridSize: 45, robotCount: 6, itemCount: 18 }
];


const ALGORITHMS: { type: AlgorithmType; label: string }[] = [
	{ type: 'gbfs',     label: 'GBFS + CBS'     },
	{ type: 'dijkstra', label: 'Dijkstra + CBS'  },
	{ type: 'astar',    label: 'A* + CBS'        }
];

const density   = 0.15;   // 15% obstacle density — uniform across all scenarios
const variance  = 0.50;   // 50% cost variance   — uniform across all scenarios
const SEEDS     = ['seed_test_5', 'seed_test_6', 'seed_test_7'];
const timeoutMs = 30000;  // 30 s per algorithm run

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
			let totalRuntime = 0;
			let totalNodes = 0;
			let totalSOC = 0;
			let totalMakespan = 0;
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
						totalRuntime += res.searchMetrics.runtimeMs || dur;
						totalNodes += res.searchMetrics.expandedNodes;
						totalSOC += res.solutionMetrics.totalCost;
						totalMakespan += res.solutionMetrics.makespan;
						successCount++;
					} else {
						errors.push(res.errorMessage || 'Timeout');
					}
				} catch (err: any) {
					errors.push(err.message || 'Crashed');
				}
			}

			const displaySuccess = successCount > 0 ? (successCount === SEEDS.length ? 'Yes' : `Yes (${successCount}/${SEEDS.length})`) : 'No';
			const avgRuntime = successCount > 0 ? Math.round(totalRuntime / successCount) : 0;
			const avgNodes = successCount > 0 ? Math.round(totalNodes / successCount) : 0;
			const avgSOC = successCount > 0 ? Math.round(totalSOC / successCount) : 0;
			const avgMakespan = successCount > 0 ? Math.round(totalMakespan / successCount) : 0;
			const combinedError = errors.length > 0 ? errors.join('; ') : '';

			results.push({
				scenarioId: sc.id, name: sc.name, vertices,
				robots: sc.robotCount, items: sc.itemCount,
				obstacleDensityPct: density * 100,
				algorithm: alg.label,
				success:       displaySuccess,
				runtimeMs:     avgRuntime,
				expandedNodes: avgNodes,
				soc:           avgSOC,
				makespan:      avgMakespan,
				error:         combinedError
			});

			if (successCount > 0) {
				console.log(
					`   ✓ ${alg.label.padEnd(15)}: avg ${avgRuntime} ms | ` +
					`avg nodes: ${avgNodes.toLocaleString()} | ` +
					`avg SOC: ${avgSOC} | ` +
					`avg makespan: ${avgMakespan} ` +
					`(${successCount}/${SEEDS.length} seeds succeeded)`
				);
			} else {
				console.log(`   ✗ ${alg.label.padEnd(15)}: FAILED (all seeds failed/timed out: ${combinedError})`);
			}
		}
		console.log('');
	}

	// ── Console summary table ─────────────────────────────────────────────────
	const W = 100;
	console.log('='.repeat(W));
	console.log(' BENCHMARK RESULTS'.padEnd(W));
	console.log('='.repeat(W));
	const hdr = [
		'Scenario'.padEnd(22),
		'Algorithm'.padEnd(16),
		'OK'.padEnd(4),
		'ms'.padStart(8),
		'Nodes'.padStart(10),
		'SOC'.padStart(8),
		'Makespan'.padStart(10),
	].join(' | ');
	console.log(hdr);
	console.log('-'.repeat(W));
	for (const r of results) {
		console.log([
			r.name.padEnd(22),
			r.algorithm.padEnd(16),
			r.success.padEnd(4),
			String(r.runtimeMs).padStart(8),
			String(r.expandedNodes).padStart(10),
			String(r.soc).padStart(8),
			String(r.makespan).padStart(10),
		].join(' | '));
	}
	console.log('='.repeat(W) + '\n');

	// ── CSV export ────────────────────────────────────────────────────────────
	const csvHeaders = [
		'Scenario ID', 'Scenario Name', 'Grid Vertices', 'Grid Size',
		'Robots', 'Items', 'Obstacle Density (%)', 'Algorithm',
		'Success', 'Runtime (ms)', 'Nodes Expanded', 'Sum of Costs (SOC)', 'Makespan', 'Error'
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
			r.runtimeMs,
			r.expandedNodes,
			r.soc,
			r.makespan,
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
