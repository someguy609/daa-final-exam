<script lang="ts">
	import { Cpu, Loader2 } from '@lucide/svelte';
	import {
		selectedAlgorithmStore,
		isLoadingStore,
		runPathfinding
	} from '../../stores/simulationStore';
</script>

<div class="flex flex-col gap-4 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-xl w-full animate-in fade-in duration-200">
	<!-- Pathfinding Trigger Header -->
	<div>
		<h3 class="text-sm font-semibold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-2">
			<Cpu class="w-4 h-4 text-zinc-500" />
			Pathfinding Planner
		</h3>

		<div class="flex flex-col gap-3">
			<div>
				<label class="text-xs font-semibold text-zinc-500 block mb-1" for="algorithm-select">Low-Level Search Algorithm</label>
				<select
					id="algorithm-select"
					bind:value={$selectedAlgorithmStore}
					class="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-100 text-sm focus:outline-none focus:border-zinc-700 font-semibold cursor-pointer"
				>
					<option value="astar">A* + CBS (Optimal, Guided)</option>
					<option value="dijkstra">Dijkstra + CBS (Optimal, Cost-Aware)</option>
					<option value="gbfs">GBFS + CBS (Fast Baseline, Non-Optimal)</option>
				</select>
			</div>

			<button
				onclick={runPathfinding}
				disabled={$isLoadingStore}
				class="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-800/40 text-zinc-950 disabled:text-zinc-500 font-bold rounded-lg text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99] duration-150"
			>
				{#if $isLoadingStore}
					<Loader2 class="w-4 h-4 animate-spin text-zinc-500" />
					Finding Collision-Free Paths...
				{:else}
					Calculate Routing (CBS)
				{/if}
			</button>
		</div>
	</div>
</div>
