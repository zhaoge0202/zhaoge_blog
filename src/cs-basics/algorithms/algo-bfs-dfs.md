---
title: "BFS 和 DFS 怎么选？"
description: "从层序与递归栈讲清图/树搜索。"
breadcrumb: true
article: true
editLink: false
category:
  - "算法"
tag:
  - "必会"
  - "高频"
  - "基础"
prev:
  text: "二分查找怎么写对？"
  link: "/cs-basics/algorithms/algo-binary-search.html"
next:
  text: "回溯模板怎么套？"
  link: "/cs-basics/algorithms/algo-backtracking.html"
---

# BFS 和 DFS 怎么选？

> BFS 用队列按层推进，天然适合无权最短；DFS 用递归栈一路走到底，适合连通块与路径枚举。

## 本质差异

两者都是「从起点扩展邻居」，差别在**待扩展集合的数据结构**：

|          | BFS                | DFS                  |
| -------- | ------------------ | -------------------- |
| 结构     | 队列（先进先出）   | 递归调用栈 / 显式栈  |
| 扩展顺序 | 离起点近的先处理   | 沿一条路走到头再回溯 |
| 天然优势 | 层序、无权最短步数 | 穷尽路径、连通块标记 |
| 空间形态 | 最坏一层的宽度     | 最坏一条路径的深度   |

BFS 像水面波纹一圈圈扩；DFS 像钻井，先打穿一条竖井再换位置。树通常无环，很多遍历不必 `visited`；图/网格有环或可回走，**必须标记访问**，否则死循环。

## 选型表

| 需求                      | 优先选     | 原因                     |
| ------------------------- | ---------- | ------------------------ |
| 无权图最短路径 / 最少步数 | BFS        | 第一次到达即最短边数     |
| 二叉树层序 / 按层输出     | BFS        | 队列天然分层             |
| 多源扩散（如腐烂橘子）    | 多源 BFS   | 所有源同时入队再扩       |
| 连通块数量 / 面积         | DFS 更顺手 | 递归标记代码短；BFS 也可 |
| 路径是否存在              | 二者皆可   | DFS 常更短               |
| 枚举全部路径 / 全排列     | DFS + 回溯 | 路径在栈帧里自然维护     |
| 拓扑排序（Kahn）          | BFS        | 按入度为 0 的层推进      |
| 拓扑排序（DFS 着色）      | DFS        | 三色标记检测环           |

口诀：题干出现「最少几步、最短、扩散」→ BFS；出现「所有方案、连通块、是否可达」→ 先想 DFS。

## BFS 模板：层序与步数

```text
function bfs(start):
    queue = [start]
    visited[start] = true
    step = 0
    while queue 非空:
        size = queue 当前长度          // 本层节点数
        for i in 1..size:
            u = queue.pop_front()
            if u 是目标: return step
            for v in neighbors(u):
                if not visited[v] and 合法:
                    visited[v] = true  // 入队时标记，防重复入队
                    queue.push_back(v)
        step += 1
    return -1  // 不可达
```

要点：① **入队即标记**，不要出队再标，否则同一节点多次入队；② 用本层 `size` 包住一圈才能正确统计层数；③ 无权图第一次碰到目标时的 `step` 就是最短边数，有权最短请改 Dijkstra。

多源 BFS：初始化时把所有源点一并入队并标记，再按同一套层序扩——相当于超级源连到所有源。

## DFS 模板：递归与 visited

```text
function dfs(u):
    visited[u] = true
    for v in neighbors(u):
        if not visited[v] and 合法:
            dfs(v)

function dfsGrid(grid, i, j):
    if 越界 or grid[i][j] 不是目标: return
    grid[i][j] = 已访问标记           // 先标记，再扩展
    for each (di, dj) in 四方向:
        dfsGrid(grid, i + di, j + dj)
```

顺序必须是：**先标记，再扩展邻居**。标记写晚，两个相邻格子会互相递归，栈瞬间爆掉。深度过大时递归可能栈溢出，可改成显式栈。

| 场景           | visited              |
| -------------- | -------------------- |
| 二叉树递归遍历 | 通常不需要           |
| 无向图         | 必须，否则父子互访   |
| 有向图         | 通常需要；判环用三色 |
| 矩阵四方向     | 必须                 |

## 代表题 1：网格岛屿数量

扫描矩阵，每遇到一块未访问陆地，岛屿数 `+1`，再 DFS/BFS 把整座岛染掉。

```text
function numIslands(grid):
    if grid 为空: return 0
    count = 0
    for i in 0..m-1:
        for j in 0..n-1:
            if grid[i][j] == '1':
                count += 1
                dfs(grid, i, j)   // 沉岛：标 '0' 后四向递归
    return count
```

若题目求**迷宫最短路径**（上下左右、单位步长），换成 BFS：起点入队，层序扩展，首次走到终点返回步数。

边界：空矩阵/全水 → 0；全陆地 → 1；仅斜向相邻在四方向规则下算两座；单格陆地 → 1。

## 代表题 2：二叉树层序与图连通分量

**二叉树层序**——标准 BFS，树无环一般不用 `visited`：

```text
function levelOrder(root):
    if root == null: return []
    queue = [root]; result = []
    while queue 非空:
        size = len(queue); level = []
        for i in 1..size:
            node = queue.pop_front()
            level.append(node.val)
            if node.left:  queue.push(node.left)
            if node.right: queue.push(node.right)
        result.append(level)
    return result
```

**图连通分量**：对每个未访问顶点开一次 DFS/BFS，分量数 `+1`。`visited` 已覆盖无向图「从 v 走回 u」的问题。

```text
function countComponents(n, edges):
    build 邻接表; visited = [false] * n; count = 0
    for u in 0..n-1:
        if not visited[u]:
            count += 1; dfs(u)
    return count
```

## 网格四方向与复杂度

```text
DIRS = [(1,0), (-1,0), (0,1), (0,-1)]
# 先判 0<=ni<m and 0<=nj<n，再读 grid[ni][nj]
```

统一用方向数组，比手写四段递归少漏条件。需要八方向时再补对角。

邻接表图：时间 `O(V+E)`，空间 `O(V)`（visited + 队列/栈）。`m×n` 网格：格子当点、四向当边 → 时间/空间均 `O(mn)`。

## 边界与易错点

| 问题                 | 处理                                 |
| -------------------- | ------------------------------------ |
| 空图 / 空树 / 空网格 | 入口直接返回 0 或空列表              |
| 自环、重边           | `visited` 保证不重复扩展；建图可去重 |
| 未标记 / 标记过晚    | 死循环或相邻点互相递归、重复入队     |
| 深递归栈溢出         | 改显式栈，或说明系统栈限制           |
| BFS 层数错乱         | 必须用本层 `size` 包住扩展           |
| 有权最短误用 BFS     | 边权不等时 BFS 不再正确              |

## 小结

1. BFS 队列按层，无权最短与层序首选；DFS 栈深搜，连通块与路径枚举首选。
2. 图与网格必须 `visited`，且应在扩展前/入队时标记。
3. 网格题用四方向数组 + 先越界再访问。
4. 复杂度邻接表 `O(V+E)`，网格 `O(mn)`。
5. 空输入、自环重边、深递归与层数统计是手写高频坑。

## 参考

综合自 BFS/DFS 基础模板、网格搜索与树图遍历常见题型整理，并统一了选型与 visited 时机。
