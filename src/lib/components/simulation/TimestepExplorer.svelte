<script lang="ts">
	import { History } from '@lucide/svelte';
	import { timestepStore, makespanStore } from '../../stores/simulationStore';
</script>

<div class="flex flex-col gap-3 bg-zinc-950 border border-zinc-800 p-5 rounded-2xl shadow-xl w-full">
	<div class="flex justify-between items-center">
		<h3 class="text-sm font-semibold text-zinc-400 tracking-wider uppercase flex items-center gap-2">
			<History class="w-4 h-4 text-zinc-500" />
			Timestep Explorer
		</h3>
		<div class="flex items-baseline gap-1 bg-zinc-900 border border-zinc-850 px-2.5 py-0.5 rounded-full text-xs font-semibold text-zinc-400">
			<span class="text-zinc-200 font-bold">{$timestepStore}</span>
			<span class="text-zinc-600">/</span>
			<span>{$makespanStore}</span>
		</div>
	</div>

	<!-- Timestep scrubber slider -->
	<div class="flex items-center gap-3">
		<input
			type="range"
			min="0"
			max={$makespanStore}
			disabled={$makespanStore === 0}
			bind:value={$timestepStore}
			class="w-full accent-zinc-200 bg-zinc-900 h-2 rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
		/>
	</div>

	{#if $makespanStore === 0}
		<p class="text-[10px] text-zinc-600 font-medium leading-normal">
			Calculate paths first to explore timesteps.
		</p>
	{:else}
		<p class="text-[10px] text-zinc-500 font-medium leading-normal">
			Scrub slider to visualize robots sliding and items being collected.
		</p>
	{/if}
</div>
