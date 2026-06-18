<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Wrench,
		BarChart3,
		Warehouse,
		Shuffle
	} from '@lucide/svelte';
	import {
		gridStore,
		robotsStore,
		docksStore,
		itemsStore,
		pathsStore,
		seedStore,
		generateScenario,
		errorMessageStore,
		assignItemRobot
	} from '$lib/stores/simulationStore';

	// Component imports
	import WarehouseGrid from '$lib/components/grid/WarehouseGrid.svelte';
	import EditorToolbar from '$lib/components/editor/EditorToolbar.svelte';
	import SimulationControls from '$lib/components/controls/SimulationControls.svelte';
	import StatisticsPanel from '$lib/components/statistics/StatisticsPanel.svelte';
	import BenchmarkDashboard from '$lib/components/benchmark/BenchmarkDashboard.svelte';
	import PlaybackFloatingPanel from '$lib/components/controls/PlaybackFloatingPanel.svelte';

	// Active tab inside sidebar
	let activeSidebarTab = $state<'editor' | 'controls' | 'benchmark'>('editor');

	// Map editor local brush settings
	let activeTool = $state<'pointer' | 'cost' | 'obstacle' | 'robot' | 'item' | 'delete'>('pointer');
	let selectedCost = $state(5);
	let selectedRobotColor = $state('#ef4444');
	let showPaths = $state(true);

	// Generator configuration parameters
	let gridWidth = $state(12);
	let gridHeight = $state(12);
	let obstacleDensity = $state(0.15);
	let costVariance = $state(0.5);
	let robotCount = $state(3);
	let itemCount = $state(6);
	let generatorSeed = $state('cbs_warehouse');

	// Auto-generate default map on load to give user a ready-to-run sandbox
	onMount(() => {
		if ($gridStore.length === 0) {
			generateScenario(12, 12, 0.15, 0.5, 3, 6, 'cbs_warehouse');
		}
	});

	function handleGenerate() {
		// Enforce safety limits
		const w = Math.max(4, Math.min(320, gridWidth));
		const h = Math.max(4, Math.min(320, gridHeight));
		const r = Math.max(1, Math.min(80, robotCount));
		const items = Math.max(1, Math.min(320, itemCount));

		generateScenario(
			w,
			h,
			obstacleDensity,
			costVariance,
			r,
			items,
			generatorSeed
		);
		// Sync local seed state
		generatorSeed = $seedStore;
	}

	function handleRandomizeSeed() {
		generatorSeed = Math.random().toString(36).substring(2, 10);
	}
</script>

<svelte:head>
	<title>Multi-Robot Warehouse Routing Simulator (CBS)</title>
	<meta name="description" content="An interactive simulator for evaluating multi-robot warehouse routing using Conflict-Based Search (CBS) combined with GBFS, Dijkstra, and A* solvers." />
</svelte:head>

<div class="h-screen w-screen bg-background text-foreground flex overflow-hidden font-sans">
	<!-- Left Sidebar (Title, Map generator, File utilities) -->
	<aside class="w-80 border-r border-border bg-card text-card-foreground flex flex-col h-full overflow-hidden select-none">
		<!-- Title & Branding -->
		<div class="p-4 border-b border-border flex items-center gap-3">
			<div class="p-2 bg-muted border border-border rounded-lg flex items-center justify-center text-zinc-100">
				<Warehouse class="w-5 h-5 text-zinc-400" />
			</div>
			<div>
				<h1 class="text-sm font-black text-foreground tracking-tight flex items-center gap-1.5">
					Multi-Robot Router & Planner
				</h1>
			</div>
		</div>

		<!-- Scrollable Generator & Map Settings Section -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			{#if $errorMessageStore}
				<div class="p-3 bg-red-950/40 border border-red-900/50 text-red-400 rounded-lg text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
					⚠️ {$errorMessageStore}
				</div>
			{/if}

			<!-- Generator Section -->
			<div class="space-y-3">
				<h3 class="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-2">
					<Shuffle class="w-3.5 h-3.5 text-muted-foreground" />
					Random Generator
				</h3>

				<div class="grid grid-cols-2 gap-2.5">
					<div>
						<label class="text-[10px] font-semibold text-muted-foreground block mb-1" for="width-input">Width</label>
						<input
							id="width-input"
							type="number"
							min="4"
							max="320"
							bind:value={gridWidth}
							class="w-full bg-muted border border-input rounded-md p-2 text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono"
						/>
					</div>
					<div>
						<label class="text-[10px] font-semibold text-muted-foreground block mb-1" for="height-input">Height</label>
						<input
							id="height-input"
							type="number"
							min="4"
							max="320"
							bind:value={gridHeight}
							class="w-full bg-muted border border-input rounded-md p-2 text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-2.5">
					<div>
						<label class="text-[10px] font-semibold text-muted-foreground block mb-1" for="robots-input">Robots ({robotCount})</label>
						<input
							id="robots-input"
							type="number"
							min="1"
							max="80"
							bind:value={robotCount}
							class="w-full bg-muted border border-input rounded-md p-2 text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono"
						/>
					</div>
					<div>
						<label class="text-[10px] font-semibold text-muted-foreground block mb-1" for="items-input">Items ({itemCount})</label>
						<input
							id="items-input"
							type="number"
							min="1"
							max="320"
							bind:value={itemCount}
							class="w-full bg-muted border border-input rounded-md p-2 text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono"
						/>
					</div>
				</div>

				<div class="space-y-3.5">
					<div>
						<div class="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
							<label for="density-slider">Obstacle Density</label>
							<span>{Math.round(obstacleDensity * 100)}%</span>
						</div>
						<input
							id="density-slider"
							type="range"
							min="0"
							max="0.6"
							step="0.05"
							bind:value={obstacleDensity}
							class="w-full accent-zinc-500 bg-muted h-1 rounded-lg appearance-none cursor-pointer"
						/>
					</div>

					<div>
						<div class="flex justify-between text-[10px] font-semibold text-muted-foreground mb-1">
							<label for="variance-slider">Cost Variance</label>
							<span>{Math.round(costVariance * 100)}%</span>
						</div>
						<input
							id="variance-slider"
							type="range"
							min="0"
							max="1"
							step="0.1"
							bind:value={costVariance}
							class="w-full accent-zinc-500 bg-muted h-1 rounded-lg appearance-none cursor-pointer"
						/>
					</div>

					<div>
						<label class="text-[10px] font-semibold text-muted-foreground block mb-1" for="seed-input">Generator Seed</label>
						<div class="flex gap-1.5">
							<input
								id="seed-input"
								type="text"
								bind:value={generatorSeed}
								class="w-full bg-muted border border-input rounded-md px-2.5 py-1 text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium font-mono"
							/>
							<button
								type="button"
								onclick={handleRandomizeSeed}
								class="px-2.5 bg-secondary hover:bg-secondary/80 border border-border text-secondary-foreground rounded-md transition-colors text-xs font-semibold cursor-pointer"
								title="Randomize Seed"
							>
								🎲
							</button>
						</div>
					</div>
				</div>

				<button
					type="button"
					onclick={handleGenerate}
					class="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-md text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow"
				>
					Generate Scenario
				</button>
			</div>

			<hr class="border-border" />

			<!-- Map Settings Options -->
			<div class="space-y-2.5">
				<h3 class="text-xs font-bold text-muted-foreground tracking-wider uppercase">Map Options</h3>
				<label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none">
					<input
						type="checkbox"
						bind:checked={showPaths}
						class="accent-zinc-500 w-3.5 h-3.5 bg-muted border-input rounded focus:ring-0 cursor-pointer"
					/>
					Show Planned Paths
				</label>
			</div>

			<hr class="border-border" />

			<!-- Robot Configurations Section -->
			<div class="space-y-3">
				<h3 class="text-xs font-bold text-muted-foreground tracking-wider uppercase">
					Robot Configurator
				</h3>
				{#if $robotsStore.length === 0}
					<p class="text-[10px] text-muted-foreground italic">No robots placed in the warehouse.</p>
				{:else}
					<div class="space-y-2 max-h-40 overflow-y-auto pr-1">
						{#each $robotsStore as robot, robotIdx}
							<div class="flex items-center gap-2 bg-muted/40 border border-border/60 p-2 rounded-lg text-xs animate-in fade-in duration-200">
								<!-- Robot icon design matching map -->
								<div class="relative w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full border border-white/85 shadow-md" style="background-color: {robot.color}">
									<!-- Visor plate -->
									<div class="absolute w-3.5 h-1.5 bg-zinc-950 rounded-full top-[3px] flex justify-center gap-0.5 px-0.5">
										<!-- Glowing sensor eyes -->
										<div class="w-0.5 h-0.5 bg-cyan-300 rounded-full"></div>
										<div class="w-0.5 h-0.5 bg-cyan-300 rounded-full"></div>
									</div>
									<!-- Initial -->
									<span class="text-[8px] text-white font-black absolute bottom-[1.5px] tracking-tight">
										{robot.name[0]?.toUpperCase() || 'R'}
									</span>
								</div>
								<input
									type="text"
									bind:value={$robotsStore[robotIdx].name}
									class="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-700 font-medium"
									placeholder="Robot Name"
								/>
								<span class="text-[9px] text-muted-foreground font-mono flex-shrink-0">({$docksStore[robot.dockId]?.x},{$docksStore[robot.dockId]?.y})</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<hr class="border-border" />

			<!-- Item Owner / Assignments Section -->
			<div class="space-y-3">
				<h3 class="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-2">
					Item Assignments & Names
				</h3>
				{#if $itemsStore.length === 0}
					<p class="text-[10px] text-muted-foreground italic">No items placed in the warehouse.</p>
				{:else}
					<div class="space-y-2 max-h-40 overflow-y-auto pr-1">
						{#each $itemsStore as item, itemIdx}
							<div class="flex items-center gap-2 bg-muted/40 border border-border/60 p-2 rounded-lg text-xs animate-in fade-in duration-200">
								<!-- Item icon matching map -->
								<svg class="w-4 h-4 flex-shrink-0 shadow-sm" viewBox="0 0 16 16">
									<rect x="1" y="1" width="14" height="14" rx="2" fill="#b45309" stroke="#451a03" stroke-width="1.5" />
									<rect x="3" y="3" width="10" height="10" fill="transparent" stroke="#451a03" stroke-width="1" />
									<line x1="3" y1="3" x2="13" y2="13" stroke="#451a03" stroke-width="1" />
									<line x1="13" y1="3" x2="3" y2="13" stroke="#451a03" stroke-width="1" />
								</svg>
								<!-- Dropdown beside it -->
								<select
									value={item.assignedRobotId || ''}
									onchange={(e) => assignItemRobot(item.id, e.currentTarget.value || null)}
									class="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer font-semibold max-w-[80px]"
								>
									<option value="">None</option>
									{#each $robotsStore as robot}
										<option value={robot.id}>{robot.name}</option>
									{/each}
								</select>
								<!-- Input beside it -->
								<input
									type="text"
									bind:value={$itemsStore[itemIdx].name}
									class="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-zinc-700 font-medium"
									placeholder="Item Name"
								/>
								<span class="text-[9px] text-muted-foreground font-mono flex-shrink-0">({item.x},{item.y})</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</aside>

	<!-- Center Canvas (Map viewport with floating toolbar) -->
	<main class="flex-1 bg-background flex flex-col items-center justify-center relative p-6 h-full overflow-hidden">
		<!-- Floating Editor Toolbar overlay at top -->
		<div class="absolute top-6 z-20">
			<EditorToolbar
				bind:activeTool
				bind:selectedCost
				bind:selectedRobotColor
			/>
		</div>

		<!-- Centered Grid Map Viewport (Takes full space and centers automatically) -->
		<div class="w-full h-full flex-1 relative mt-16 mb-4">
			<WarehouseGrid
				{showPaths}
				{activeTool}
				{selectedCost}
				{selectedRobotColor}
			/>
		</div>

		{#if Object.keys($pathsStore).length > 0}
			<div class="absolute bottom-6 z-20">
				<PlaybackFloatingPanel />
			</div>
		{/if}
	</main>

	<!-- Right Sidebar (Controls, Playback, Stats, Benchmarks) -->
	<aside class="w-[360px] border-l border-border bg-card text-card-foreground flex flex-col h-full overflow-hidden select-none">
		<!-- Tab header selectors -->
		<div class="flex bg-muted border-b border-border p-2 gap-1.5">
			<button
				type="button"
				onclick={() => (activeSidebarTab = 'editor')}
				class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeSidebarTab === 'editor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				<Wrench class="w-3.5 h-3.5" />
				Planner
			</button>
			<button
				type="button"
				onclick={() => (activeSidebarTab = 'benchmark')}
				class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer {activeSidebarTab === 'benchmark' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
			>
				<BarChart3 class="w-3.5 h-3.5" />
				Benchmark
			</button>
		</div>

		<!-- Scrollable Tab Content panels -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			{#if activeSidebarTab === 'editor'}
				<div class="space-y-4 animate-in fade-in duration-200">
					<SimulationControls />
					{#if Object.keys($pathsStore).length > 0}
						<div class="space-y-4 animate-in slide-in-from-bottom duration-300">
							<StatisticsPanel />
						</div>
					{/if}
				</div>
			{:else if activeSidebarTab === 'benchmark'}
				<BenchmarkDashboard />
			{/if}
		</div>
	</aside>
</div>
