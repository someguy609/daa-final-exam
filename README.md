# Multi-Robot Warehouse Routing Simulator (CBS)
### EF234405 Design & Analysis of Algorithms — Final Exam Capstone Project
*"Design It, Prove It, Build It, Measure It"*

---

## 1. Project Overview
This repository contains a full capstone project implementing a **Multi-Robot Warehouse Routing & Planner** simulator. It models the **Multi-Agent Path Finding (MAPF)** problem in a simulated warehouse using **Conflict-Based Search (CBS)** as the high-level conflict-resolution framework, combined with three distinct low-level pathfinding search solvers: **A\***, **Dijkstra**, and **Greedy Best-First Search (GBFS)**.

The system is designed to simulate Autonomous Guided Vehicles (AGVs) navigating a warehouse layout, picking up items, and returning to their dedicated docks.

---

## 2. Formal Computational Model
The warehouse is formulated as a precise, weighted, directed graph $G = (V, E)$:

1. **Vertices ($V$)**: Each traversable cell in the warehouse grid is a vertex $v \in V$. Each vertex has a travel cost $w(v) \in [1, 10]$ (representing floor conditions or congestion) and an obstacle state (representing shelves or blockages).
2. **Edges ($E$)**: Directed edges exist between adjacent orthogonal cells:
   $$E = \{ (u, v) \mid u, v \in V \text{ are traversable, and } |u.x - v.x| + |u.y - v.y| = 1 \}$$
3. **Edge Weights**: The weight of edge $(u, v)$ is the traversal cost of the destination cell $v$, representing the cost of moving into cell $v$.
4. **Source & Targets**:
   - Each robot starts at its designated **Dock** ($D_i \in V$).
   - Each robot is assigned a sequence of **Items** ($I_j \in V$) to collect.
   - The path target sequence is: start at dock $\rightarrow$ visit assigned items in nearest-neighbor order $\rightarrow$ return to dock.
5. **Constraints**:
   - **Vertex Conflict**: Two robots cannot occupy the same vertex at the same time:
     $$\forall r_a \neq r_b, \quad P_{r_a}(t) \neq P_{r_b}(t)$$
   - **Edge Conflict**: Two robots cannot traverse the same edge in opposite directions at the same time (swapping places):
     $$\forall r_a \neq r_b, \quad (P_{r_a}(t), P_{r_a}(t+1)) \neq (P_{r_b}(t+1), P_{r_b}(t))$$
6. **Objective**: Minimize the **Sum of Costs (SOC)** of all paths:
   $$\min \sum_{r} \text{Cost}(P_r)$$

---

## 3. Algorithms Implemented
The application contains two layers of algorithmic planning:

### High-Level Solver: Conflict-Based Search (CBS)
- Builds a Constraint Tree (CT) where each node represents a set of path constraints for individual robots.
- Performs a best-first search on the CT. When a conflict (vertex or edge collision) is detected on the current set of paths, CBS splits the node into two child nodes, adding constraints to separate the conflicting robots, and recalculates paths.

### Low-Level Solvers
1. **A\*** (Optimal + Heuristic): Solves individual paths using $f(n) = g(n) + h(n)$, where $g(n)$ is the accumulated travel cost and $h(n)$ is the Manhattan distance heuristic.
2. **Dijkstra** (Optimal, No Heuristic): Explores cells strictly sorted by accumulated travel cost $g(n)$, acting as the heuristic-free optimal comparison.
3. **Greedy Best-First Search (GBFS)** (Naïve/Fast Heuristic Baseline): Explores cells sorted strictly by Manhattan distance heuristic $h(n)$ to the goal. It is extremely fast but non-optimal, serving as the baseline for comparison.

---

## 4. Technical Specifications & Scale
The benchmark sweep exercises the algorithms on non-trivial grid instances spanning **two orders of magnitude** (from 36 vertices to 3,600 vertices) and satisfies the **$n \ge 1,000$ vertices scale requirement**:

- **Scenario 1 (6x6)**: 36 vertices (low-scale baseline)
- **Scenario 2 (12x12)**: 144 vertices
- **Scenario 3 (20x20)**: 400 vertices
- **Scenario 4 (32x32)**: 1,024 vertices (satisfying $n \ge 1,000$)
- **Scenario 5 (60x60)**: 3,600 vertices (satisfying $100\times$ sweep)

All grids are generated deterministically using fixed, reproducible random seeds.

---

## 5. How to Run

### Development & Visual Demo GUI
The project provides a premium interactive web UI built using Svelte 5 and Tailwind CSS:

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the development server:
   ```bash
   pnpm run dev
   ```
3. Open `http://localhost:5173` in your browser.
   - Use the **Planner** sidebar to paint custom costs, toggle obstacles, manually place robots/items, edit names, reassign items, and trigger route planning.
   - Use the **Benchmark** sidebar to run scenario sweeps and view a responsive, real-time SVG comparison chart.
   - Use the **Screenshot** button on the toolbar to export the high-fidelity map canvas as a PNG.

### Standalone Command-Line Benchmark
To regenerate timing data, correctness comparisons, and log metrics under fixed seeds:

Run the one-command CLI benchmark script:
```bash
pnpm benchmark
```
This script runs the sweep over all 5 scenarios for A\*, Dijkstra, and GBFS CBS. It displays a structured result table on the console and saves the timing data to:
- `benchmark_results.csv`
