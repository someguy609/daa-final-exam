<script lang="ts">
	import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import {
		isPlayingStore,
		playbackSpeedStore,
		timestepStore,
		makespanStore,
		startPlayback,
		pausePlayback,
		resetPlayback,
		stepForward,
		stepBackward
	} from '../../stores/simulationStore';

	const SPEED_OPTIONS = [0.5, 1, 2, 4];
</script>

<div class="flex items-center justify-between gap-4 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 px-4 py-2.5 rounded-xl shadow-2xl w-[560px] animate-in slide-in-from-bottom duration-300 select-none">
	<!-- 1. Playback controls -->
	<div class="flex items-center gap-1.5">
		<!-- Step Backward -->
		<button
			type="button"
			onclick={stepBackward}
			disabled={$timestepStore === 0}
			class="w-8 h-8 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-850 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
			title="Step Backward"
		>
			<ChevronLeft class="w-3.5 h-3.5" />
		</button>

		<!-- Play/Pause Toggle -->
		{#if $isPlayingStore}
			<button
				type="button"
				onclick={pausePlayback}
				class="w-9 h-9 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-950 rounded-lg transition-all cursor-pointer hover:scale-105 shadow-md"
				title="Pause"
			>
				<Pause class="w-4 h-4 fill-current" />
			</button>
		{:else}
			<button
				type="button"
				onclick={startPlayback}
				disabled={$makespanStore === 0 || $timestepStore === $makespanStore}
				class="w-9 h-9 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-650 rounded-lg transition-all cursor-pointer hover:scale-105 shadow-md"
				title="Play"
			>
				<Play class="w-4 h-4 fill-current ml-0.5" />
			</button>
		{/if}

		<!-- Step Forward -->
		<button
			type="button"
			onclick={stepForward}
			disabled={$makespanStore === 0 || $timestepStore === $makespanStore}
			class="w-8 h-8 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-850 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
			title="Step Forward"
		>
			<ChevronRight class="w-3.5 h-3.5" />
		</button>

		<!-- Reset -->
		<button
			type="button"
			onclick={resetPlayback}
			disabled={$makespanStore === 0}
			class="w-8 h-8 flex items-center justify-center bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-850 hover:border-zinc-700 text-zinc-300 rounded-lg transition-all cursor-pointer"
			title="Reset Playback"
		>
			<RotateCcw class="w-3.5 h-3.5" />
		</button>
	</div>

	<!-- Divider -->
	<div class="w-[1px] h-6 bg-zinc-800"></div>

	<!-- 2. Timestep scrubber slider -->
	<div class="flex-1 flex items-center gap-3">
		<input
			type="range"
			min="0"
			max={$makespanStore}
			disabled={$makespanStore === 0}
			bind:value={$timestepStore}
			class="flex-1 accent-zinc-200 bg-zinc-950 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
		/>
		<div class="flex items-center gap-0.5 text-[10px] font-mono font-bold text-zinc-400 bg-zinc-950 border border-zinc-850 px-2 py-0.5 rounded-md min-w-[56px] justify-center">
			<span class="text-zinc-200">{$timestepStore}</span>
			<span class="text-zinc-600">/</span>
			<span>{$makespanStore}</span>
		</div>
	</div>

	<!-- Divider -->
	<div class="w-[1px] h-6 bg-zinc-800"></div>

	<!-- 3. Speed selector -->
	<div class="flex gap-0.5 bg-zinc-950 border border-zinc-850 p-0.5 rounded-lg">
		{#each SPEED_OPTIONS as speed}
			<button
				type="button"
				onclick={() => playbackSpeedStore.set(speed)}
				class="px-2 py-1 text-[10px] font-black rounded-md transition-colors cursor-pointer {$playbackSpeedStore === speed ? 'bg-zinc-850 text-zinc-200 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}"
			>
				{speed}x
			</button>
		{/each}
	</div>
</div>
