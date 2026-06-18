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
const seed      = 'seed_test_5';
const timeoutMs = 30000;  // 30 s per algorithm run

async function runBenchmark() {
	console.log('============================================================');
	console.log('        DAA CAPSTONE PROJECT — BENCHMARK RUNNER             ');
	console.log('============================================================');
	console.log(`Obstacle density : ${density * 100}%  (uniform, all scenarios)`);
	console.log(`Cost variance    : ${variance * 100}%  (uniform, all scenarios)`);
	console.log(`Random seed      : "${seed}"`);
	console.log(`Timeout / algo   : ${timeoutMs / 1000} s`);
	console.log('------------------------------------------------------------\n');

	const results: any[] = [];

	for (const sc of SCENARIOS) {
		const vertices = sc.gridSize * sc.gridSize;
		console.log(`▶  ${sc.name}  (vertices: ${vertices})...`);

		let generated = null;
		let genError  = '';
		try {
			generated = generateRandomScenario(
				sc.gridSize, sc.gridSize,
				density, variance,
				sc.robotCount, sc.itemCount,
				seed + '_' + sc.id
			);
		} catch (err: any) {
			genError = err.message || 'Generation failed';
		}

		for (const alg of ALGORITHMS) {
			if (!generated) {
				results.push({
					scenarioId: sc.id, name: sc.name, vertices,
					robots: sc.robotCount, items: sc.itemCount,
					obstacleDensityPct: density * 100,
					algorithm: alg.label, success: 'No',
					runtimeMs: 0, expandedNodes: 0,
					soc: 0, makespan: 0, error: genError || 'Generation failed'
				});
				console.log(`   ✗ ${alg.label.padEnd(15)}: FAILED (generation error)`);
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

				results.push({
					scenarioId: sc.id, name: sc.name, vertices,
					robots: sc.robotCount, items: sc.itemCount,
					obstacleDensityPct: density * 100,
					algorithm: alg.label,
					success:       res.success ? 'Yes' : 'No',
					runtimeMs:     res.success ? Math.round(res.searchMetrics.runtimeMs || dur) : 0,
					expandedNodes: res.success ? res.searchMetrics.expandedNodes : 0,
					soc:           res.success ? res.solutionMetrics.totalCost    : 0,
					makespan:      res.success ? res.solutionMetrics.makespan      : 0,
					error:         res.errorMessage || (res.success ? '' : 'Timeout')
				});

				if (res.success) {
					console.log(
						`   ✓ ${alg.label.padEnd(15)}: ${Math.round(dur)} ms | ` +
						`nodes: ${res.searchMetrics.expandedNodes.toLocaleString()} | ` +
						`SOC: ${res.solutionMetrics.totalCost} | ` +
						`makespan: ${res.solutionMetrics.makespan}`
					);
				} else {
					console.log(`   ✗ ${alg.label.padEnd(15)}: TIMEOUT/FAILED (${res.errorMessage || ''})`);
				}
			} catch (err: any) {
				results.push({
					scenarioId: sc.id, name: sc.name, vertices,
					robots: sc.robotCount, items: sc.itemCount,
					obstacleDensityPct: density * 100,
					algorithm: alg.label, success: 'No',
					runtimeMs: 0, expandedNodes: 0,
					soc: 0, makespan: 0, error: err.message || 'Crashed'
				});
				console.log(`   ✗ ${alg.label.padEnd(15)}: CRASHED (${err.message || err})`);
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
