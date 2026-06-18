<script lang="ts">
	import { BarChart3, Network, Zap, CheckSquare } from '@lucide/svelte';
	import {
		searchMetricsStore,
		cbsMetricsStore,
		solutionMetricsStore,
		itemsStore,
		collectedItemsStore,
		errorMessageStore
	} from '../../stores/simulationStore';

	let collectedCount = $derived($collectedItemsStore.filter((item) => item.collected).length);
</script>

<div class="flex flex-col gap-4 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-xl w-full">
	<h3 class="text-sm font-semibold text-zinc-400 tracking-wider uppercase flex items-center gap-2">
		<BarChart3 class="w-4 h-4 text-zinc-500" />
		Metrics & Statistics
	</h3>

	<!-- Error Message Display -->
	{#if $errorMessageStore}
		<div class="bg-red-950/20 border border-red-900/60 p-3.5 rounded-xl text-red-400 text-xs font-semibold leading-relaxed shadow-inner">
			⚠️ {$errorMessageStore}
		</div>
	{/if}

	{#if !$searchMetricsStore && !$solutionMetricsStore}
		<div class="text-zinc-600 text-xs font-medium py-4 text-center leading-normal">
			No simulation metrics. Click "Calculate Routing" to run.
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<!-- 1. Solution Metrics -->
			{#if $solutionMetricsStore}
				<div class="bg-zinc-900 border border-zinc-850 p-4 rounded-xl shadow-sm">
					<span class="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mb-3">
						<CheckSquare class="w-3.5 h-3.5 text-zinc-500" />
						Solution Quality
					</span>
					<div class="grid grid-cols-2 gap-3.5">
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Sum of Costs (SOC)</span>
							<span class="text-lg font-black text-emerald-400">{$solutionMetricsStore.totalCost}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Makespan (Time)</span>
							<span class="text-lg font-black text-zinc-200">{$solutionMetricsStore.makespan}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Total Distance</span>
							<span class="text-lg font-black text-zinc-200">{$solutionMetricsStore.totalDistance}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Collected Items</span>
							<span class="text-lg font-black text-zinc-200">{collectedCount} / {$itemsStore.length}</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- 2. CBS Metrics -->
			{#if $cbsMetricsStore}
				<div class="bg-zinc-900 border border-zinc-850 p-4 rounded-xl shadow-sm">
					<span class="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mb-3">
						<Network class="w-3.5 h-3.5 text-zinc-500" />
						High-Level CBS Search
					</span>
					<div class="grid grid-cols-3 gap-2">
						<div class="bg-zinc-950 border border-zinc-850/60 p-2 rounded-lg flex flex-col justify-center items-center text-center">
							<span class="text-[8px] font-bold text-zinc-500 uppercase mb-0.5">Constraints</span>
							<span class="text-sm font-black text-zinc-200">{$cbsMetricsStore.cbsConstraints}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2 rounded-lg flex flex-col justify-center items-center text-center">
							<span class="text-[8px] font-bold text-zinc-500 uppercase mb-0.5">CT Nodes</span>
							<span class="text-sm font-black text-zinc-200">{$cbsMetricsStore.cbsCTNodes}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2 rounded-lg flex flex-col justify-center items-center text-center">
							<span class="text-[8px] font-bold text-zinc-500 uppercase mb-0.5">Conflicts</span>
							<span class="text-sm font-black text-orange-400">{$cbsMetricsStore.conflictCount}</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- 3. Search Metrics -->
			{#if $searchMetricsStore}
				<div class="bg-zinc-900 border border-zinc-850 p-4 rounded-xl shadow-sm">
					<span class="text-xs font-bold text-zinc-400 flex items-center gap-1.5 mb-3">
						<Zap class="w-3.5 h-3.5 text-zinc-500" />
						Low-Level Solver Performance
					</span>
					<div class="grid grid-cols-2 gap-3.5">
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Runtime (CPU)</span>
							<span class="text-lg font-black text-zinc-200">{$searchMetricsStore.runtimeMs} ms</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Peak Frontier</span>
							<span class="text-lg font-black text-zinc-200">{$searchMetricsStore.peakFrontierSize}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Expanded Nodes</span>
							<span class="text-lg font-black text-zinc-200">{$searchMetricsStore.expandedNodes}</span>
						</div>
						<div class="bg-zinc-950 border border-zinc-850/60 p-2.5 rounded-lg flex flex-col justify-center">
							<span class="text-[9px] font-bold text-zinc-500 uppercase">Generated Nodes</span>
							<span class="text-lg font-black text-zinc-200">{$searchMetricsStore.generatedNodes}</span>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
