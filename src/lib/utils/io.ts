import type { Grid, Robot, Dock, Item, Position, Path } from '../simulation/models/types';
import {
	gridStore,
	robotsStore,
	docksStore,
	itemsStore,
	robotGoalsStore,
	seedStore,
	pathsStore
} from '../stores/simulationStore';

// 1. Export Scenario to JSON
export function exportScenarioToJSON(
	grid: Grid,
	robots: Robot[],
	docks: Record<string, Dock>,
	items: Item[],
	robotGoals: Record<string, Position[]>,
	seed: string
) {
	const data = {
		version: '1.0',
		seed,
		grid: grid.map((row) =>
			row.map((cell) => ({
				x: cell.x,
				y: cell.y,
				cost: cell.cost,
				isObstacle: cell.isObstacle
			}))
		),
		robots,
		docks,
		items,
		robotGoals
	};

	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `warehouse_scenario_${seed}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

// 2. Import Scenario from JSON
export function importScenarioFromJSON(file: File): Promise<void> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = JSON.parse(e.target?.result as string);
				if (!data.grid || !data.robots || !data.docks || !data.items || !data.robotGoals) {
					throw new Error('Invalid scenario file format.');
				}

				gridStore.set(data.grid);
				robotsStore.set(data.robots);
				docksStore.set(data.docks);
				itemsStore.set(data.items);
				robotGoalsStore.set(data.robotGoals);
				seedStore.set(data.seed || 'imported_seed');
				pathsStore.set({}); // clear prior paths

				resolve();
			} catch (err) {
				reject(err);
			}
		};
		reader.onerror = () => reject(new Error('Failed to read file.'));
		reader.readAsText(file);
	});
}

// 3. Export Benchmark Results to CSV
export function exportBenchmarkToCSV(progressList: any[]) {
	const headers = [
		'Scenario ID',
		'Grid Size',
		'Robot Count',
		'Item Count',
		'Algorithm',
		'Success',
		'Runtime (ms)',
		'Nodes Expanded',
		'CBS CT Nodes',
		'SOC (Cost)',
		'Makespan',
		'Error'
	];

	const rows = [headers.join(',')];

	for (const item of progressList) {
		const algs = ['gbfs', 'dijkstra', 'astar'];
		for (const alg of algs) {
			const res = item.results[alg];
			if (res) {
				const row = [
					item.scenarioId,
					`${item.gridSize}x${item.gridSize}`,
					item.robotCount,
					item.itemCount,
					alg.toUpperCase(),
					res.success ? 'TRUE' : 'FALSE',
					res.success ? res.runtimeMs : '-',
					res.success ? res.expandedNodes : '-',
					res.success ? res.cbsCTNodes : '-',
					res.success ? res.totalCost : '-',
					res.success ? res.makespan : '-',
					res.error ? `"${res.error.replace(/"/g, '""')}"` : ''
				];
				rows.push(row.join(','));
			}
		}
	}

	const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n');
	const encodedUri = encodeURI(csvContent);
	const link = document.createElement('a');
	link.setAttribute('href', encodedUri);
	link.setAttribute('download', 'warehouse_benchmark_results.csv');
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}
