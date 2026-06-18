<script lang="ts">
	import { get } from 'svelte/store';
	import { Plus, Minus, RotateCcw } from '@lucide/svelte';
	import {
		gridStore,
		robotsStore,
		docksStore,
		itemsStore,
		pathsStore,
		playbackSpeedStore,
		currentPositionsStore,
		collectedItemsStore,
		recomputeRobotGoals,
		screenshotTriggerStore
	} from '../../stores/simulationStore';
	import type { Cell } from '../../simulation/models/types';
	import { BIZARRE_NAMES } from '../../simulation/generators/generator';

	interface Props {
		showPaths: boolean;
		activeTool: 'pointer' | 'cost' | 'obstacle' | 'robot' | 'item' | 'delete';
		selectedCost: number;
		selectedRobotColor: string;
	}

	let {
		showPaths = true,
		activeTool = 'pointer',
		selectedCost = 5,
		selectedRobotColor = '#ef4444'
	}: Props = $props();

	const gapSize = 2; // px

	// Derive cell size based on grid dimensions to fit 600px container
	let cellSize = $derived.by(() => {
		const grid = $gridStore;
		if (grid.length === 0) return 32;
		const maxDim = Math.max(grid.length, grid[0].length);
		return Math.max(8, Math.min(48, Math.floor(600 / maxDim)));
	});

	let robotSize = $derived(Math.max(6, Math.floor(cellSize * 0.75)));
	let itemSize = $derived(Math.max(6, Math.floor(cellSize * 0.6)));

	// HSL cost styling for traversable terrain
	function getCellBg(cell: Cell): string {
		if (cell.isObstacle) return '#1e293b'; // slate-800
		const lightness = 80 - (cell.cost - 1) * 6.5;
		return `hsl(215, 20%, ${lightness}%)`;
	}

	// Canvas ref and container dimensions
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let containerWidth = $state(600);
	let containerHeight = $state(500);

	// Viewport state
	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let hoveredCell = $state<Cell | null>(null);

	let isDrawing = false;
	let isPanning = false;
	let lastPaintedCell = { x: -1, y: -1 };
	let lastMousePos = { x: 0, y: 0 };

	// Derived entity hover states
	let hoveredRobot = $derived.by(() => {
		const hc = hoveredCell;
		if (!hc) return null;
		return $robotsStore.find((r) => {
			const pos = $currentPositionsStore[r.id];
			return pos && Math.round(pos.x) === hc.x && Math.round(pos.y) === hc.y;
		}) || null;
	});

	let hoveredDock = $derived.by(() => {
		const hc = hoveredCell;
		if (!hc) return null;
		return Object.values($docksStore).find((d) => d.x === hc.x && d.y === hc.y) || null;
	});

	let hoveredItem = $derived.by(() => {
		const hc = hoveredCell;
		if (!hc) return null;
		return $itemsStore.find((i) => i.x === hc.x && i.y === hc.y) || null;
	});

	// Register screenshot trigger function
	$effect(() => {
		if (canvasElement) {
			screenshotTriggerStore.set(() => {
				const dataUrl = canvasElement!.toDataURL('image/png');
				const link = document.createElement('a');
				link.download = `warehouse_screenshot_${Date.now()}.png`;
				link.href = dataUrl;
				link.click();
			});
		}
		return () => {
			screenshotTriggerStore.set(null);
		};
	});

	// Animating robot positions
	let animatedPositions = $state<Record<string, { x: number; y: number }>>({});
	let animationFrameId: number;

	$effect(() => {
		const positions = $currentPositionsStore;
		
		// Setup target coordinates
		const targetPositions: Record<string, { x: number; y: number }> = {};
		for (const rId of Object.keys(positions)) {
			targetPositions[rId] = { x: positions[rId].x, y: positions[rId].y };
		}
		
		const startPositions = { ...animatedPositions };
		
		// If first render, initialize immediately
		if (Object.keys(startPositions).length === 0) {
			animatedPositions = targetPositions;
			return;
		}

		const startTime = performance.now();
		const duration = 250 / $playbackSpeedStore; // duration in ms

		function animateStep(timestamp: number) {
			const elapsed = timestamp - startTime;
			const progress = Math.min(1, elapsed / duration);
			
			// cubic ease-out
			const ease = 1 - Math.pow(1 - progress, 3); 

			const nextPos: Record<string, { x: number; y: number }> = {};
			let finished = true;

			for (const rId of Object.keys(targetPositions)) {
				const start = startPositions[rId] || targetPositions[rId];
				const target = targetPositions[rId];
				
				const dx = target.x - start.x;
				const dy = target.y - start.y;

				nextPos[rId] = {
					x: start.x + dx * ease,
					y: start.y + dy * ease
				};

				if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
					finished = false;
				}
			}

			animatedPositions = nextPos;

			if (progress < 1 && !finished) {
				animationFrameId = requestAnimationFrame(animateStep);
			}
		}

		cancelAnimationFrame(animationFrameId);
		animationFrameId = requestAnimationFrame(animateStep);

		return () => cancelAnimationFrame(animationFrameId);
	});

	// Map screen mouse position back to logical coordinates, taking fitScale, zoom, and pan offset into account
	function getCellFromMouseEvent(e: MouseEvent): Cell | null {
		if (!canvasElement) return null;
		const rect = canvasElement.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const grid = $gridStore;
		if (grid.length === 0) return null;

		const cSize = cellSize;
		const mapWidth = grid[0].length * (cSize + gapSize) - gapSize;
		const mapHeight = grid.length * (cSize + gapSize) - gapSize;

		// Center fit calculations
		const scaleX = (containerWidth - 32) / mapWidth;
		const scaleY = (containerHeight - 32) / mapHeight;
		const fitScale = Math.min(1, Math.min(scaleX, scaleY));
		const activeScale = fitScale * zoom;

		const defaultOffsetX = (containerWidth - mapWidth * activeScale) / 2;
		const defaultOffsetY = (containerHeight - mapHeight * activeScale) / 2;

		const logicalX = (mouseX - (defaultOffsetX + panX)) / activeScale;
		const logicalY = (mouseY - (defaultOffsetY + panY)) / activeScale;

		const cellX = Math.floor(logicalX / (cSize + gapSize));
		const cellY = Math.floor(logicalY / (cSize + gapSize));

		if (cellY >= 0 && cellY < grid.length && cellX >= 0 && cellX < grid[0].length) {
			return grid[cellY][cellX];
		}
		return null;
	}

	// Canvas rendering loop
	$effect(() => {
		const grid = $gridStore;
		const docks = $docksStore;
		const items = $collectedItemsStore;
		const robots = $robotsStore;
		const positions = $currentPositionsStore;
		const paths = $pathsStore;
		const cSize = cellSize;
		const showP = showPaths;

		if (!canvasElement || grid.length === 0) return;

		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		// Resize canvas backing store to match parent container bounds for crystal-clear render
		canvasElement.width = containerWidth;
		canvasElement.height = containerHeight;

		ctx.clearRect(0, 0, containerWidth, containerHeight);

		// Calculate fitting scale
		const mapWidth = grid[0].length * (cSize + gapSize) - gapSize;
		const mapHeight = grid.length * (cSize + gapSize) - gapSize;

		const scaleX = (containerWidth - 32) / mapWidth;
		const scaleY = (containerHeight - 32) / mapHeight;
		const fitScale = Math.min(1, Math.min(scaleX, scaleY));
		const activeScale = fitScale * zoom;

		const defaultOffsetX = (containerWidth - mapWidth * activeScale) / 2;
		const defaultOffsetY = (containerHeight - mapHeight * activeScale) / 2;

		ctx.save();
		// Apply center offset + user pan + user zoom
		ctx.translate(defaultOffsetX + panX, defaultOffsetY + panY);
		ctx.scale(activeScale, activeScale);

		// 1. Draw grid cells
		for (let y = 0; y < grid.length; y++) {
			for (let x = 0; x < grid[y].length; x++) {
				const cell = grid[y][x];
				const cx = x * (cSize + gapSize);
				const cy = y * (cSize + gapSize);

				ctx.fillStyle = getCellBg(cell);
				const radius = cSize > 16 ? 4 : 1;
				drawRoundedRect(ctx, cx, cy, cSize, cSize, radius);
				ctx.fill();

				// Draw obstacle stripe pattern
				if (cell.isObstacle) {
					ctx.save();
					ctx.beginPath();
					drawRoundedRect(ctx, cx, cy, cSize, cSize, radius);
					ctx.clip();

					ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)'; // dark slate stripe
					ctx.lineWidth = 1.5;
					for (let i = -cSize; i < cSize * 2; i += 6) {
						ctx.beginPath();
						ctx.moveTo(cx + i, cy);
						ctx.lineTo(cx + i + cSize, cy + cSize);
						ctx.stroke();
					}
					ctx.restore();
				}

				// Draw dock border layout (Replaces hexagon dock icon)
				let cellRobotColor: string | null = null;
				for (const d of Object.values(docks)) {
					if (d.x === x && d.y === y) {
						const robot = robots.find((r) => r.id === d.robotId);
						if (robot) {
							cellRobotColor = robot.color;
						}
						break;
					}
				}
				if (cellRobotColor) {
					ctx.save();
					ctx.strokeStyle = cellRobotColor;
					const strokeW = Math.max(1.5, Math.floor(cSize * 0.1));
					ctx.lineWidth = strokeW;
					drawRoundedRect(ctx, cx + strokeW/2, cy + strokeW/2, cSize - strokeW, cSize - strokeW, radius);
					ctx.stroke();

					// light translucent fill of the robot color inside dock cell
					ctx.fillStyle = cellRobotColor;
					ctx.globalAlpha = 0.12;
					ctx.fill();
					ctx.restore();
				}

				// Draw Cost number text
				if (cSize >= 20 && !cell.isObstacle) {
					ctx.fillStyle = 'rgba(9, 9, 11, 0.4)';
					ctx.font = `bold ${Math.max(8, Math.floor(cSize * 0.45))}px sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillText(cell.cost.toString(), cx + cSize / 2, cy + cSize / 2);
				}
			}
		}

		// 2. Draw planned robot paths
		if (showP) {
			for (const robot of robots) {
				const path = paths[robot.id];
				if (path && path.length > 0) {
					ctx.beginPath();
					ctx.strokeStyle = robot.color;
					ctx.lineWidth = Math.max(1.5, Math.floor(cSize * 0.15));
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.globalAlpha = 0.55;

					let first = true;
					let lastPos = { x: -1, y: -1 };
					for (const step of path) {
						const sx = step.x * (cSize + gapSize) + cSize / 2;
						const sy = step.y * (cSize + gapSize) + cSize / 2;
						if (first) {
							ctx.moveTo(sx, sy);
							first = false;
							lastPos = step;
						} else {
							if (lastPos.x !== step.x || lastPos.y !== step.y) {
								ctx.lineTo(sx, sy);
								lastPos = step;
							}
						}
					}
					ctx.stroke();
					ctx.globalAlpha = 1.0;
				}
			}
		}

		// 3. Draw Items (Wooden pack crates)
		for (const item of items) {
			const robot = robots.find((r) => r.id === item.assignedRobotId);
			const cx = item.x * (cSize + gapSize) + cSize / 2;
			const cy = item.y * (cSize + gapSize) + cSize / 2;

			ctx.save();
			if (item.collected) {
				ctx.globalAlpha = 0.3;
			}

			if (cSize >= 16) {
				const iSize = itemSize;
				const rx = cx - iSize / 2;
				const ry = cy - iSize / 2;

				// Crate shadow
				ctx.shadowColor = 'rgba(217, 119, 6, 0.25)';
				ctx.shadowBlur = 3;

				// Wooden box frame
				ctx.fillStyle = '#b45309'; // wood base (amber-700)
				ctx.strokeStyle = '#451a03'; // dark wood frame (amber-950)
				const strokeW = Math.max(1.5, iSize * 0.08);
				ctx.lineWidth = strokeW;
				drawRoundedRect(ctx, rx, ry, iSize, iSize, 2);
				ctx.fill();
				ctx.stroke();
				ctx.shadowColor = 'transparent';

				// Planks bracing cross "X"
				ctx.strokeStyle = '#451a03';
				ctx.lineWidth = Math.max(1, iSize * 0.06);
				ctx.beginPath();
				// diagonal planks
				ctx.moveTo(rx + strokeW, ry + strokeW);
				ctx.lineTo(rx + iSize - strokeW, ry + iSize - strokeW);
				ctx.moveTo(rx + iSize - strokeW, ry + strokeW);
				ctx.lineTo(rx + strokeW, ry + iSize - strokeW);
				// inner border panel
				ctx.rect(rx + strokeW, ry + strokeW, iSize - 2 * strokeW, iSize - 2 * strokeW);
				ctx.stroke();

				// Checked overlay when item collected
				if (item.collected) {
					ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
					drawRoundedRect(ctx, rx, ry, iSize, iSize, 2);
					ctx.fill();

					// checkmark indicator
					ctx.strokeStyle = '#10b981';
					ctx.lineWidth = Math.max(2, iSize * 0.12);
					ctx.lineCap = 'round';
					ctx.beginPath();
					ctx.moveTo(cx - iSize / 4, cy);
					ctx.lineTo(cx - iSize / 12, cy + iSize / 6);
					ctx.lineTo(cx + iSize / 3, cy - iSize / 4);
					ctx.stroke();
				}

				// Robot assignment tag
				if (robot) {
					ctx.beginPath();
					ctx.arc(cx + iSize / 2, cy - iSize / 2, 2.5, 0, 2 * Math.PI);
					ctx.fillStyle = robot.color;
					ctx.strokeStyle = '#ffffff';
					ctx.lineWidth = 0.75;
					ctx.fill();
					ctx.stroke();
				}
			} else {
				// Simple dot representation for tiny scale
				ctx.beginPath();
				ctx.rect(cx - 2.5, cy - 2.5, 5, 5);
				ctx.fillStyle = item.collected ? '#34d399' : '#f59e0b';
				ctx.fill();
			}
			ctx.restore();
		}

		// 4. Draw Robots (AGV vector body design)
		const animPos = Object.keys(animatedPositions).length > 0 ? animatedPositions : positions;
		for (const rId of Object.keys(positions)) {
			const robot = robots.find((r) => r.id === rId);
			const pos = animPos[rId] || positions[rId];
			if (robot && pos) {
				const cx = pos.x * (cSize + gapSize) + cSize / 2;
				const cy = pos.y * (cSize + gapSize) + cSize / 2;
				const rSize = robotSize;

				ctx.save();
				// Main chassis disc
				ctx.beginPath();
				ctx.arc(cx, cy, rSize / 2, 0, 2 * Math.PI);
				ctx.fillStyle = robot.color;
				ctx.strokeStyle = '#ffffff';
				ctx.lineWidth = Math.max(1.5, rSize * 0.08);
				ctx.fill();
				ctx.stroke();

				// Visor plate
				const vWidth = rSize * 0.65;
				const vHeight = rSize * 0.25;
				ctx.fillStyle = '#09090b';
				drawRoundedRect(ctx, cx - vWidth / 2, cy - vHeight / 2 - rSize * 0.05, vWidth, vHeight, vHeight / 2);
				ctx.fill();

				// Glowing cyan sensor lights (eyes)
				ctx.fillStyle = '#67e8f9';
				ctx.beginPath();
				ctx.arc(cx - vWidth / 4, cy - rSize * 0.05, Math.max(1, rSize * 0.05), 0, 2 * Math.PI);
				ctx.arc(cx + vWidth / 4, cy - rSize * 0.05, Math.max(1, rSize * 0.05), 0, 2 * Math.PI);
				ctx.fill();

				// Robot Initials Label text
				const label = (robot.name ? robot.name[0] : '')?.toUpperCase() || 'R';
				const fontSize = Math.max(6, Math.floor(rSize * 0.35));
				ctx.fillStyle = '#ffffff';
				ctx.font = `bold ${fontSize}px sans-serif`;
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(label, cx, cy + rSize * 0.23);
				ctx.restore();
			}
		}

		ctx.restore();
	});

	// Draw rounded corners helper for 2D context
	function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
		if (w < 2 * r) r = w / 2;
		if (h < 2 * r) r = h / 2;
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	// Interactive Drawing & Panning Event Handlers
	function handleMouseDown(e: MouseEvent) {
		lastMousePos = { x: e.clientX, y: e.clientY };

		// Right click (button 2) or left click with pointer tool triggers panning
		if (e.button === 2 || (e.button === 0 && activeTool === 'pointer')) {
			isPanning = true;
			e.preventDefault();
		} else if (e.button === 0) {
			// Left click starts drawing/painting
			isDrawing = true;
			lastPaintedCell = { x: -1, y: -1 };
			const cell = getCellFromMouseEvent(e);
			if (cell) {
				lastPaintedCell = { x: cell.x, y: cell.y };
				handleCellClick(cell);
			}
		}
	}

	function handleMouseMove(e: MouseEvent) {
		const currentMouseX = e.clientX;
		const currentMouseY = e.clientY;

		if (isPanning) {
			panX += currentMouseX - lastMousePos.x;
			panY += currentMouseY - lastMousePos.y;
		} else if (isDrawing) {
			const cell = getCellFromMouseEvent(e);
			if (cell && (cell.x !== lastPaintedCell.x || cell.y !== lastPaintedCell.y)) {
				lastPaintedCell = { x: cell.x, y: cell.y };
				handleCellClick(cell);
			}
		}

		lastMousePos = { x: currentMouseX, y: currentMouseY };
		hoveredCell = getCellFromMouseEvent(e);
	}

	function handleMouseUp() {
		isDrawing = false;
		isPanning = false;
	}

	function handleMouseLeave() {
		isDrawing = false;
		isPanning = false;
		hoveredCell = null;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const zoomFactor = 1.1;
		if (e.deltaY < 0) {
			zoom = Math.min(10, zoom * zoomFactor);
		} else {
			zoom = Math.max(0.25, zoom / zoomFactor);
		}
	}

	function handleCellClick(cell: Cell) {
		if (activeTool === 'pointer') return;

		// 1. Cost brush (Recreates cell object reference for reactivity)
		if (activeTool === 'cost') {
			gridStore.update((g) => {
				const newRow = [...g[cell.y]];
				newRow[cell.x] = { ...newRow[cell.x], cost: selectedCost, isObstacle: false };
				const newGrid = [...g];
				newGrid[cell.y] = newRow;
				return newGrid;
			});
		}
		// 2. Toggle obstacle (Recreates cell object reference for reactivity)
		else if (activeTool === 'obstacle') {
			gridStore.update((g) => {
				const newRow = [...g[cell.y]];
				newRow[cell.x] = { ...newRow[cell.x], isObstacle: !newRow[cell.x].isObstacle };
				const newGrid = [...g];
				newGrid[cell.y] = newRow;
				return newGrid;
			});
			const isObstacle = get(gridStore)[cell.y][cell.x].isObstacle;
			if (isObstacle) {
				removeRobotOrItemAt(cell.x, cell.y);
			}
		}
		// 3. Robot Placement (Creates robot + dock)
		else if (activeTool === 'robot') {
			if (cell.isObstacle) return;
			if (hasDockAt(cell.x, cell.y) || hasItemAt(cell.x, cell.y)) return;

			robotsStore.update((list) => {
				const nextId = `R${list.length + 1}`;
				const nextDockId = `D${list.length + 1}`;

				const newRobot = {
					id: nextId,
					name: BIZARRE_NAMES[list.length % BIZARRE_NAMES.length],
					color: selectedRobotColor,
					dockId: nextDockId
				};

				docksStore.update((docks) => {
					docks[nextDockId] = {
						id: nextDockId,
						robotId: nextId,
						x: cell.x,
						y: cell.y
					};
					return { ...docks };
				});

				return [...list, newRobot];
			});
			recomputeRobotGoals();
		}
		// 4. Item placement
		else if (activeTool === 'item') {
			if (cell.isObstacle) return;
			if (hasDockAt(cell.x, cell.y) || hasItemAt(cell.x, cell.y)) return;

			itemsStore.update((list) => {
				const nextId = `I${list.length + 1}`;
				const newItem = {
					id: nextId,
					name: `Crate ${list.length + 1}`,
					x: cell.x,
					y: cell.y,
					assignedRobotId: null,
					collected: false
				};
				return [...list, newItem];
			});
			recomputeRobotGoals();
		}
		// 5. Delete tool
		else if (activeTool === 'delete') {
			removeRobotOrItemAt(cell.x, cell.y);
		}

		pathsStore.set({});
	}

	function hasDockAt(x: number, y: number): boolean {
		return Object.values($docksStore).some((d) => d.x === x && d.y === y);
	}

	function hasItemAt(x: number, y: number): boolean {
		return $itemsStore.some((item) => item.x === x && item.y === y);
	}

	function removeRobotOrItemAt(x: number, y: number) {
		itemsStore.update((items) => items.filter((item) => !(item.x === x && item.y === y)));

		let removedDockId: string | null = null;
		docksStore.update((docks) => {
			const nextDocks: Record<string, any> = {};
			for (const id of Object.keys(docks)) {
				if (docks[id].x === x && docks[id].y === y) {
					removedDockId = id;
				} else {
					nextDocks[id] = docks[id];
				}
			}
			return nextDocks;
		});

		if (removedDockId) {
			robotsStore.update((robots) => {
				return robots.filter((r) => r.dockId !== removedDockId);
			});
		}

		recomputeRobotGoals();
		pathsStore.set({});
	}
</script>

<div
	bind:clientWidth={containerWidth}
	bind:clientHeight={containerHeight}
	class="w-full h-full relative overflow-hidden flex items-center justify-center bg-[#090d16] border border-zinc-900 rounded-xl shadow-2xl select-none"
>
	{#if $gridStore.length === 0}
		<div class="text-zinc-500 h-96 flex items-center justify-center font-medium">
			No active warehouse layout. Generate a map or paint one.
		</div>
	{:else}
		<!-- HTML5 Canvas for super fast drawing of cells and entities -->
		<canvas
			bind:this={canvasElement}
			onmousedown={handleMouseDown}
			onmousemove={handleMouseMove}
			onmouseup={handleMouseUp}
			onmouseleave={handleMouseLeave}
			onwheel={handleWheel}
			oncontextmenu={(e) => e.preventDefault()}
			class="w-full h-full object-contain cursor-crosshair block"
		></canvas>

		<!-- Tooltips / Hover Inspector Info Badge (Doesn't show cost on obstacles) -->
		{#if hoveredCell}
			<div class="absolute bottom-4 left-4 bg-zinc-950/90 border border-zinc-800 px-3 py-2 rounded-lg shadow-lg text-xs text-zinc-400 font-mono z-20 pointer-events-none flex flex-col gap-0.5 animate-in fade-in duration-200">
				<div><span class="text-zinc-500">Coord:</span> ({hoveredCell.x}, {hoveredCell.y})</div>
				{#if !hoveredCell.isObstacle}
					<div><span class="text-zinc-500">Cost:</span> {hoveredCell.cost}</div>
				{/if}
				<div><span class="text-zinc-500">Type:</span> {hoveredCell.isObstacle ? 'Obstacle' : 'Traversable'}</div>
				{#if hoveredRobot}
					<div class="mt-1 border-t border-zinc-800/80 pt-1">
						<span class="text-zinc-500">Robot:</span> <span class="font-bold text-zinc-200">{hoveredRobot.name}</span>
					</div>
				{/if}
				{#if hoveredDock}
					{@const dockRobot = $robotsStore.find(r => r.id === hoveredDock.robotId)}
					<div class="mt-1 border-t border-zinc-800/80 pt-1">
						<span class="text-zinc-500">Dock:</span> <span class="font-bold text-zinc-200">{dockRobot ? `${dockRobot.name}'s Dock` : 'Dock'}</span>
					</div>
				{/if}
				{#if hoveredItem}
					{@const itemOwner = hoveredItem.assignedRobotId ? $robotsStore.find(r => r.id === hoveredItem.assignedRobotId) : null}
					<div class="mt-1 border-t border-zinc-800/80 pt-1">
						<span class="text-zinc-500">Item:</span> <span class="font-bold text-amber-400">{hoveredItem.name}</span>
						{#if itemOwner}
							<div class="text-[10px] pl-2 text-zinc-500">
								Owner: <span class="text-zinc-400 font-medium">{itemOwner.name}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Zoom / Navigation Overlay Controls -->
		<div class="absolute bottom-4 right-4 flex flex-col gap-1.5 bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg shadow-lg z-20">
			<button
				type="button"
				onclick={() => (zoom = Math.min(10, zoom * 1.25))}
				class="w-7 h-7 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 cursor-pointer transition-colors"
				title="Zoom In"
			>
				<Plus class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				onclick={() => (zoom = Math.max(0.25, zoom / 1.25))}
				class="w-7 h-7 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 cursor-pointer transition-colors"
				title="Zoom Out"
			>
				<Minus class="w-3.5 h-3.5" />
			</button>
			<button
				type="button"
				onclick={() => {
					zoom = 1;
					panX = 0;
					panY = 0;
				}}
				class="w-7 h-7 flex items-center justify-center bg-zinc-950 border border-zinc-800 rounded-md hover:bg-zinc-800 hover:text-white text-zinc-400 cursor-pointer transition-colors"
				title="Reset View"
			>
				<RotateCcw class="w-3.5 h-3.5" />
			</button>
		</div>
	{/if}
</div>
