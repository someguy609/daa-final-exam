<script lang="ts">
	import { Play, Loader2, BarChart2, Award, Clock, Trash2 } from '@lucide/svelte';
	import {
		isBenchmarkingStore,
		benchmarkProgressStore,
		startBenchmarkSweep,
		benchmarkScenariosStore
	} from '../../stores/simulationStore';
	import type { AlgorithmType, BenchmarkSweepResult } from '../../simulation/models/types';

	const ALGORITHMS: { type: AlgorithmType; label: string; color: string }[] = [
		{ type: 'gbfs', label: 'GBFS + CBS', color: '#f87171' }, // light red
		{ type: 'dijkstra', label: 'Dijkstra + CBS', color: '#60a5fa' }, // light blue
		{ type: 'astar', label: 'A* + CBS', color: '#34d399' } // light green
	];

	// Benchmark configuration
	let density = $state(0.15);
	let variance = $state(0.5);
	let seed = $state('bench_seed');

	// Active selected chart tab
	let activeTab = $state<'runtime' | 'nodes' | 'soc'>('runtime');

	function triggerBenchmark() {
		// Enforce safety limits to prevent 0x0 or negative scenarios
		benchmarkScenariosStore.update((arr) => {
			return arr.map((s) => ({
				...s,
				gridSize: Math.max(4, Math.min(320, s.gridSize || 4)),
				robotCount: Math.max(1, Math.min(80, s.robotCount || 1)),
				itemCount: Math.max(1, Math.min(320, s.itemCount || 1))
			}));
		});
		startBenchmarkSweep(density, variance, seed);
	}

	function addScenario() {
		benchmarkScenariosStore.update((arr) => {
			const nextNum = arr.length > 0 ? Math.max(...arr.map(s => parseInt(s.id.substring(1)) || 0)) + 1 : 1;
			const last = arr[arr.length - 1] || { gridSize: 6, robotCount: 2, itemCount: 4 };
			return [
				...arr,
				{
					id: `S${nextNum}`,
					gridSize: Math.max(4, Math.min(320, (last.gridSize || 6) + 4)),
					robotCount: Math.max(1, Math.min(80, (last.robotCount || 2) + 1)),
					itemCount: Math.max(1, Math.min(320, (last.itemCount || 4) + 4))
				}
			];
		});
	}

	function deleteScenario(index: number) {
		benchmarkScenariosStore.update((arr) => {
			if (arr.length <= 1) return arr;
			const next = arr.filter((_, idx) => idx !== index);
			return next.map((s, idx) => ({ ...s, id: `S${idx + 1}` }));
		});
	}

	function resetScenariosToDefault() {
		benchmarkScenariosStore.set([
			{ id: 'S1', gridSize: 6,  robotCount: 2, itemCount: 6 },
			{ id: 'S2', gridSize: 12, robotCount: 2, itemCount: 6 },
			{ id: 'S3', gridSize: 20, robotCount: 2, itemCount: 6 },
			{ id: 'S4', gridSize: 32, robotCount: 2, itemCount: 6 },
			{ id: 'S5', gridSize: 45, robotCount: 2, itemCount: 6 }
		]);
	}

	function clampScenarioValue(idx: number, key: 'gridSize' | 'robotCount' | 'itemCount', minVal: number, maxVal: number) {
		benchmarkScenariosStore.update((arr) => {
			const s = arr[idx];
			if (s) {
				let val = s[key];
				if (val === null || val === undefined || isNaN(val)) {
					val = minVal;
				} else {
					val = Math.max(minVal, Math.min(maxVal, val));
				}
				s[key] = val;
			}
			return [...arr];
		});
	}

	// Helper to get maximum value for scaling charts
	function getMaxValue(progressList: BenchmarkSweepResult[], metric: 'runtimeMs' | 'expandedNodes' | 'totalCost'): number {
		let maxVal = 1;
		for (const item of progressList) {
			for (const alg of ALGORITHMS) {
				const res = item.results[alg.type];
				if (res && res.success) {
					const val = res[metric];
					if (val > maxVal) maxVal = val;
				}
			}
		}
		return maxVal;
	}


	// SVG Chart Dimensions (optimized for 360px sidebar wrapper)
	const chartWidth = 440;
	const chartHeight = 200;
	const padTop = 20;
	const padBottom = 30;
	const padLeft = 45;
	const padRight = 10;

	const graphWidth = chartWidth - padLeft - padRight;
	const graphHeight = chartHeight - padTop - padBottom;

	let maxRuntime = $derived(getMaxValue($benchmarkProgressStore, 'runtimeMs'));
	let maxNodes = $derived(getMaxValue($benchmarkProgressStore, 'expandedNodes'));
	let maxCost = $derived(getMaxValue($benchmarkProgressStore, 'totalCost'));

	// Map scenario index to horizontal X coordinate center of its bar group
	function getGroupCenterX(index: number): number {
		const step = graphWidth / $benchmarkScenariosStore.length;
		return padLeft + index * step + step / 2;
	}
</script>

<div class="flex flex-col gap-5 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-xl w-full">
	<div>
		<h3 class="text-sm font-semibold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-2">
			<BarChart2 class="w-4 h-4 text-zinc-500" />
			Algorithm Benchmarking
		</h3>
		<p class="text-xs text-zinc-500 mb-4 leading-normal">
			Run GBFS, Dijkstra, and A* CBS on identical map sizes.
		</p>

		<!-- Config parameters -->
		<div class="grid grid-cols-3 gap-2 mb-3">
			<div>
				<label class="text-[10px] font-bold text-zinc-500 block mb-1" for="bench-density">Density</label>
				<input
					id="bench-density"
					type="number"
					min="0"
					max="0.6"
					step="0.05"
					bind:value={density}
					class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 font-medium font-mono"
				/>
			</div>
			<div>
				<label class="text-[10px] font-bold text-zinc-500 block mb-1" for="bench-variance">Variance</label>
				<input
					id="bench-variance"
					type="number"
					min="0"
					max="1"
					step="0.1"
					bind:value={variance}
					class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 font-medium font-mono"
				/>
			</div>
			<div>
				<label class="text-[10px] font-bold text-zinc-500 block mb-1" for="bench-seed">Seed</label>
				<input
					id="bench-seed"
					type="text"
					bind:value={seed}
					class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-zinc-100 text-xs focus:outline-none focus:border-zinc-700 font-medium"
				/>
			</div>
		</div>

		<!-- Scenarios List Editor -->
		<div class="space-y-2 mb-4">
			<label class="text-[10px] font-bold text-zinc-500 block">Configure Scenario Sweep</label>
			<div class="space-y-2 max-h-48 overflow-y-auto pr-1">
				{#each $benchmarkScenariosStore as sc, scIdx}
					<div class="flex items-center gap-1.5 bg-zinc-900 border border-zinc-850 p-2 rounded-lg text-xs animate-in fade-in duration-200">
						<span class="font-bold text-zinc-400 w-6 font-mono">{sc.id}</span>
						
						<!-- Grid Size -->
						<div class="flex-1 flex flex-col gap-0.5 min-w-0">
							<span class="text-[8px] text-zinc-500 font-semibold">Grid</span>
							<input
								type="number"
								min="4"
								max="320"
								bind:value={sc.gridSize}
								onchange={() => clampScenarioValue(scIdx, 'gridSize', 4, 320)}
								onblur={() => clampScenarioValue(scIdx, 'gridSize', 4, 320)}
								class="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-355 font-mono text-[10px] focus:outline-none focus:border-zinc-700"
							/>
						</div>

						<!-- Robots -->
						<div class="flex-1 flex flex-col gap-0.5 min-w-0">
							<span class="text-[8px] text-zinc-500 font-semibold">Robots</span>
							<input
								type="number"
								min="1"
								max="80"
								bind:value={sc.robotCount}
								onchange={() => clampScenarioValue(scIdx, 'robotCount', 1, 80)}
								onblur={() => clampScenarioValue(scIdx, 'robotCount', 1, 80)}
								class="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-355 font-mono text-[10px] focus:outline-none focus:border-zinc-700"
							/>
						</div>

						<!-- Items -->
						<div class="flex-1 flex flex-col gap-0.5 min-w-0">
							<span class="text-[8px] text-zinc-500 font-semibold">Items</span>
							<input
								type="number"
								min="1"
								max="320"
								bind:value={sc.itemCount}
								onchange={() => clampScenarioValue(scIdx, 'itemCount', 1, 320)}
								onblur={() => clampScenarioValue(scIdx, 'itemCount', 1, 320)}
								class="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-zinc-355 font-mono text-[10px] focus:outline-none focus:border-zinc-700"
							/>
						</div>

						<!-- Delete Button -->
						<button
							type="button"
							onclick={() => deleteScenario(scIdx)}
							disabled={$benchmarkScenariosStore.length <= 1}
							class="self-end p-1.5 bg-zinc-950 hover:bg-red-950/40 border border-zinc-850 hover:border-red-900/30 text-zinc-500 hover:text-red-400 disabled:opacity-35 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
							title="Delete Scenario"
						>
							<Trash2 class="w-3.5 h-3.5" />
						</button>
					</div>
				{/each}
			</div>
			
			<div class="flex gap-2">
				<button
					type="button"
					onclick={addScenario}
					class="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
				>
					+ Add Scenario
				</button>
				<button
					type="button"
					onclick={resetScenariosToDefault}
					class="py-1.5 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
					title="Reset scenarios to defaults"
				>
					Reset
				</button>
			</div>
		</div>

		<button
			onclick={triggerBenchmark}
			disabled={$isBenchmarkingStore}
			class="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-500 font-bold rounded-lg text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
		>
			{#if $isBenchmarkingStore}
				<Loader2 class="w-4 h-4 animate-spin text-zinc-500" />
				Sweeping Scenario Suite ({$benchmarkProgressStore.length} / {$benchmarkScenariosStore.length})
			{:else}
				<Play class="w-4 h-4 fill-current ml-0.5" />
				Run Benchmark Suite
			{/if}
		</button>
	</div>

	{#if $benchmarkProgressStore.length > 0}
		<hr class="border-zinc-850" />

		<!-- Chart Tab Selector -->
		<div>
			<div class="flex border-b border-zinc-850 mb-4">
				<button
					onclick={() => (activeTab = 'runtime')}
					class="flex-1 pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer {activeTab === 'runtime' ? 'border-zinc-200 text-zinc-200 font-black' : 'border-transparent text-zinc-500 hover:text-zinc-350'}"
				>
					Runtime (ms)
				</button>
				<button
					onclick={() => (activeTab = 'nodes')}
					class="flex-1 pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer {activeTab === 'nodes' ? 'border-zinc-200 text-zinc-200 font-black' : 'border-transparent text-zinc-500 hover:text-zinc-350'}"
				>
					Nodes Expanded
				</button>
				<button
					onclick={() => (activeTab = 'soc')}
					class="flex-1 pb-2 text-xs font-bold transition-all border-b-2 cursor-pointer {activeTab === 'soc' ? 'border-zinc-200 text-zinc-200 font-black' : 'border-transparent text-zinc-500 hover:text-zinc-350'}"
				>
					Cost (SOC)
				</button>
			</div>

			<!-- Dynamic SVG Bar Chart -->
			<div class="relative bg-zinc-900/40 border border-zinc-900 rounded-xl p-2 shadow-inner">
				<svg viewBox="0 0 {chartWidth} {chartHeight}" class="w-full h-auto text-zinc-400 block">
					<!-- Y Axis Labels & Grid Lines -->
					{#each Array(5) as _, i}
						{@const ratio = i / 4}
						{@const yPos = padTop + graphHeight * (1 - ratio)}
						{@const activeMax = activeTab === 'runtime' ? maxRuntime : activeTab === 'nodes' ? maxNodes : maxCost}
						{@const val = Math.round(activeMax * ratio)}

						<line
							x1={padLeft}
							y1={yPos}
							x2={chartWidth - padRight}
							y2={yPos}
							stroke="#27272a"
							stroke-dasharray="2,4"
							stroke-width="1"
						/>
						<text
							x={padLeft - 6}
							y={yPos + 3}
							text-anchor="end"
							class="text-[8px] font-semibold text-zinc-650 fill-zinc-500"
						>
							{val.toLocaleString()}
						</text>
					{/each}

					<!-- Grouped Bars -->
					{#each $benchmarkScenariosStore as sc, scIdx}
						{@const scResult = $benchmarkProgressStore.find((r) => r.scenarioId === sc.id)}
						{@const groupCenterX = getGroupCenterX(scIdx)}

						<!-- X Axis Scenario Label -->
						<text
							x={groupCenterX}
							y={chartHeight - padBottom + 12}
							text-anchor="middle"
							class="text-[8px] font-black text-zinc-400 fill-zinc-400"
						>
							{sc.id}
						</text>
						<text
							x={groupCenterX}
							y={chartHeight - padBottom + 22}
							text-anchor="middle"
							class="text-[7px] font-semibold text-zinc-600 fill-zinc-500"
						>
							{sc.gridSize}²
						</text>

						{#if scResult}
							{#each ALGORITHMS as alg, algIdx}
								{@const res = scResult.results[alg.type]}
								{@const barW = 8}
								{@const groupW = ALGORITHMS.length * barW + (ALGORITHMS.length - 1) * 2}
								{@const startX = groupCenterX - groupW / 2 + algIdx * (barW + 2)}

								{#if res && res.success}
									{@const metricVal = activeTab === 'runtime' ? res.runtimeMs : activeTab === 'nodes' ? res.expandedNodes : res.totalCost}
									{@const activeMax = activeTab === 'runtime' ? maxRuntime : activeTab === 'nodes' ? maxNodes : maxCost}
									{@const barH = Math.max(2, (metricVal / activeMax) * graphHeight)}
									{@const startY = chartHeight - padBottom - barH}

									<!-- Bar rectangle -->
									<rect
										x={startX}
										y={startY}
										width={barW}
										height={barH}
										fill={alg.color}
										rx="2"
										class="opacity-95 hover:opacity-100 transition-opacity"
									>
										<title>{alg.label}: {metricVal.toLocaleString()}</title>
									</rect>
								{:else if res && res.error}
									<!-- Timeout / Error Indicator -->
									<text
										x={startX + barW / 2}
										y={chartHeight - padBottom - 4}
										text-anchor="middle"
										class="text-[7px] font-black fill-red-400"
										transform="rotate(-90 {startX + barW / 2} {chartHeight - padBottom - 4})"
									>
										T/O
									</text>
								{/if}
							{/each}
						{:else}
							<!-- Pending sweep indicator -->
							<circle
								cx={groupCenterX}
								cy={chartHeight - padBottom - graphHeight / 2}
								r="2"
								fill="#3f3f46"
								class="animate-pulse"
							/>
						{/if}
					{/each}

					<!-- Main Axis Line -->
					<line
						x1={padLeft}
						y1={chartHeight - padBottom}
						x2={chartWidth - padRight}
						y2={chartHeight - padBottom}
						stroke="#3f3f46"
						stroke-width="1.5"
					/>
				</svg>
			</div>

			<!-- Color Legend -->
			<div class="flex justify-center gap-4 mt-3">
				{#each ALGORITHMS as alg}
					<div class="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400">
						<span class="w-2.5 h-2.5 rounded-sm" style="background-color: {alg.color};"></span>
						{alg.label}
					</div>
				{/each}
			</div>
		</div>

		<!-- Benchmark Sweep Log Table -->
		<div class="bg-zinc-900 border border-zinc-850 p-3 rounded-xl shadow-sm overflow-x-auto">
			<h4 class="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
				<Clock class="w-3.5 h-3.5 text-zinc-500" />
				Benchmark Logs
			</h4>
			<table class="w-full text-left text-[9px] border-collapse">
				<thead>
					<tr class="border-b border-zinc-800 text-zinc-500 font-bold">
						<th class="pb-1.5">Size</th>
						<th class="pb-1.5">Algorithm</th>
						<th class="pb-1.5 text-right">Runtime (ms)</th>
						<th class="pb-1.5 text-right">Nodes Exp.</th>
						<th class="pb-1.5 text-right">SOC</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-850 text-zinc-300 font-medium">
					{#each $benchmarkProgressStore as item}
						{#each ALGORITHMS as alg}
							{@const res = item.results[alg.type]}
							{#if res}
								<tr class="hover:bg-zinc-850/20">
									<td class="py-1.5 font-black text-zinc-400">{item.scenarioId}</td>
									<td class="py-1.5 flex items-center gap-1.5">
										<span class="w-1.5 h-1.5 rounded-full" style="background-color: {alg.color};"></span>
										{alg.label}
									</td>
									<td class="py-1.5 text-right font-semibold">
										{res.success ? `${res.runtimeMs} ms` : 'Timeout'}
									</td>
									<td class="py-1.5 text-right">
										{res.success ? res.expandedNodes.toLocaleString() : '-'}
									</td>
									<td class="py-1.5 text-right font-black text-emerald-400">
										{res.success ? res.totalCost : '-'}
									</td>
								</tr>
							{/if}
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
