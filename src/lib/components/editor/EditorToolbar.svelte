<script lang="ts">
	import {
		MousePointer,
		Paintbrush,
		BrickWall,
		Bot,
		Package,
		Trash2,
		RotateCcw,
		Upload,
		Download,
		Camera,
		FileSpreadsheet
	} from '@lucide/svelte';
	import {
		gridStore,
		robotsStore,
		docksStore,
		itemsStore,
		robotGoalsStore,
		pathsStore,
		seedStore,
		benchmarkProgressStore,
		errorMessageStore,
		screenshotTriggerStore
	} from '../../stores/simulationStore';
	import {
		exportScenarioToJSON,
		importScenarioFromJSON,
		exportBenchmarkToCSV
	} from '../../utils/io';

	interface Props {
		activeTool: 'pointer' | 'cost' | 'obstacle' | 'robot' | 'item' | 'delete';
		selectedCost: number;
		selectedRobotColor: string;
	}

	let {
		activeTool = $bindable('pointer'),
		selectedCost = $bindable(5),
		selectedRobotColor = $bindable('#ef4444')
	}: Props = $props();

	const ROBOT_COLOR_OPTIONS = [
		'#ef4444', // Red
		'#3b82f6', // Blue
		'#10b981', // Green
		'#f59e0b', // Amber
		'#8b5cf6', // Purple
		'#ec4899', // Pink
		'#06b6d4', // Cyan
		'#14b8a6'  // Teal
	];

	function handleClearAll() {
		if (confirm('Clear the entire warehouse layout and scenario?')) {
			gridStore.set([]);
			robotsStore.set([]);
			docksStore.set({});
			itemsStore.set([]);
			robotGoalsStore.set({});
			pathsStore.set({});
			errorMessageStore.set(null);
		}
	}

	let importFileInput: HTMLInputElement | null = $state(null);

	function handleImportClick() {
		importFileInput?.click();
	}

	async function handleFileSelected(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		try {
			await importScenarioFromJSON(file);
			alert('Scenario imported successfully!');
		} catch (err: any) {
			alert('Import failed: ' + (err.message || err));
		} finally {
			target.value = ''; // Reset input
		}
	}

	function handleExportScenario() {
		exportScenarioToJSON(
			$gridStore,
			$robotsStore,
			$docksStore,
			$itemsStore,
			$robotGoalsStore,
			$seedStore
		);
	}

	function handleExportScreenshot() {
		if ($screenshotTriggerStore) {
			$screenshotTriggerStore();
		} else {
			alert('Canvas is not ready for screenshot.');
		}
	}

	function handleExportCSV() {
		if ($benchmarkProgressStore.length === 0) {
			alert('No benchmark results available. Run a benchmark first.');
			return;
		}
		exportBenchmarkToCSV($benchmarkProgressStore);
	}
</script>

<div class="flex flex-col items-center gap-1.5">
	<!-- Toolbar buttons -->
	<div class="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl shadow-lg">
		<!-- Pointer Tool -->
		<button
			type="button"
			onclick={() => (activeTool = 'pointer')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'pointer' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Pointer / Inspect"
		>
			<MousePointer class="w-4 h-4" />
		</button>

		<!-- Cost Brush -->
		<button
			type="button"
			onclick={() => (activeTool = 'cost')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'cost' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Cost Brush (Paint travel costs)"
		>
			<Paintbrush class="w-4 h-4" />
		</button>

		<!-- Obstacle Brush -->
		<button
			type="button"
			onclick={() => (activeTool = 'obstacle')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'obstacle' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Shelf Block (Toggle Obstacles)"
		>
			<BrickWall class="w-4 h-4" />
		</button>

		<!-- Place Robot -->
		<button
			type="button"
			onclick={() => (activeTool = 'robot')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'robot' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Place Robot & Dock"
		>
			<Bot class="w-4 h-4" />
		</button>

		<!-- Place Item -->
		<button
			type="button"
			onclick={() => (activeTool = 'item')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'item' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Place Item"
		>
			<Package class="w-4 h-4" />
		</button>

		<!-- Delete Tool -->
		<button
			type="button"
			onclick={() => (activeTool = 'delete')}
			class="w-9 h-9 flex items-center justify-center rounded-lg border transition-all cursor-pointer {activeTool === 'delete' ? 'bg-zinc-850 border-red-900/50 text-red-400 shadow-inner' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'}"
			title="Delete Entities"
		>
			<Trash2 class="w-4 h-4" />
		</button>

		<div class="w-[1px] h-5 bg-zinc-800 mx-1"></div>

		<!-- Clear Tool -->
		<button
			type="button"
			onclick={handleClearAll}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/30 transition-all cursor-pointer"
			title="Clear Scenario"
		>
			<RotateCcw class="w-4 h-4" />
		</button>

		<div class="w-[1px] h-5 bg-zinc-800 mx-1"></div>

		<!-- Import JSON -->
		<input
			type="file"
			accept=".json"
			bind:this={importFileInput}
			class="hidden"
			onchange={handleFileSelected}
		/>
		<button
			type="button"
			onclick={handleImportClick}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 transition-all cursor-pointer"
			title="Import Scenario JSON"
		>
			<Upload class="w-4 h-4" />
		</button>

		<!-- Export JSON -->
		<button
			type="button"
			onclick={handleExportScenario}
			disabled={$gridStore.length === 0}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
			title="Export Scenario JSON"
		>
			<Download class="w-4 h-4" />
		</button>

		<!-- Screenshot -->
		<button
			type="button"
			onclick={handleExportScreenshot}
			disabled={$gridStore.length === 0}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
			title="Export Screenshot PNG"
		>
			<Camera class="w-4 h-4" />
		</button>

		<!-- Export CSV -->
		<button
			type="button"
			onclick={handleExportCSV}
			disabled={$benchmarkProgressStore.length === 0}
			class="w-9 h-9 flex items-center justify-center rounded-lg border border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
			title="Export Benchmark Results CSV"
		>
			<FileSpreadsheet class="w-4 h-4" />
		</button>
	</div>

	<!-- Tool-Specific Settings Panel -->
	<div class="h-8 flex items-center justify-center">
		{#if activeTool === 'cost'}
			<div class="flex items-center gap-3 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg shadow-md text-xs animate-in fade-in duration-200">
				<span class="text-zinc-500 font-semibold select-none">Cost:</span>
				<input
					type="range"
					min="1"
					max="10"
					step="1"
					bind:value={selectedCost}
					class="w-20 accent-zinc-450 h-1 bg-zinc-950 rounded-lg appearance-none cursor-pointer"
				/>
				<span class="text-zinc-200 font-bold w-4 text-center">{selectedCost}</span>
			</div>
		{:else if activeTool === 'robot'}
			<div class="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg shadow-md animate-in fade-in duration-200">
				{#each ROBOT_COLOR_OPTIONS as color}
					<button
						type="button"
						onclick={() => (selectedRobotColor = color)}
						class="w-3.5 h-3.5 rounded-full border transition-transform cursor-pointer {selectedRobotColor === color ? 'scale-120 border-white ring-2 ring-zinc-700/60' : 'border-black/50 hover:scale-110'}"
						style="background-color: {color};"
						aria-label="Select color {color}"
					></button>
				{/each}
			</div>
		{/if}
	</div>
</div>
