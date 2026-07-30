---
title: "本地提交怎么撤销和整理？reset、amend 和 cherry-pick 怎么用？"
description: "从 reset 三模式、commit --amend 到 reflog 讲清本地提交的撤销与整理。"
breadcrumb: true
article: true
editLink: false
category:
  - "工具"
tag:
  - "高频"
  - "基础"
  - "项目实战"
prev:
  text: "Git"
  link: "/tools/git/"
next:
  text: "rebase 和 merge 怎么选？会带来什么风险？"
  link: "/tools/git/git-rebase-merge.html"
---

# 本地提交怎么撤销和整理？reset、amend 和 cherry-pick 怎么用？

> 本地还没 push 的提交，改起来几乎零成本；一旦 push 到了别人会拉的分支，同样的动作就可能变成事故。这篇讲清"本地提交怎么改、怎么撤"，以及和"线上回滚"的边界。

## 先分清：本地历史 vs 公共历史

Git 里撤销/整理提交，最关键的一刀是**这次提交有没有被别人看到**：

| 状态                           | 能不能改写历史                         | 用什么                                 |
| ------------------------------ | -------------------------------------- | -------------------------------------- |
| 只在本地，没 push              | 可以随便改                             | `reset`、`commit --amend`、`rebase -i` |
| 已 push 到个人分支，没人基于它 | 可以改，但要 `push --force-with-lease` | 同上 + 强推                            |
| 已 push 到 main / 多人拉的分支 | 不要改写历史                           | `git revert`（新建反向提交）           |

> 这条线决定了你能不能用 `reset`。线上回滚和公共分支撤销属于另一套（见 [线上回滚和 Git 回退怎么配合？](./git-rollback-release.html)），这篇只讲本地。

## reset 三种模式：改动的去留

`git reset` 是本地撤销提交的核心。`HEAD~1` 表示"当前提交的上一个"，把这次提交退回去：

```bash
git reset --<模式> HEAD~1
```

三种模式的区别只在一点：**撤销提交后，那些改动还留不留、留哪**。

| 模式              | 提交 | 暂存区（index）       | 工作区 | 改动去哪了                        |
| ----------------- | ---- | --------------------- | ------ | --------------------------------- |
| `--soft`          | 撤销 | 保留（改动已 staged） | 不变   | 改动留在暂存区，可直接重新 commit |
| `--mixed`（默认） | 撤销 | 回退                  | 保留   | 改动回到工作区，要重新 `git add`  |
| `--hard`          | 撤销 | 回退                  | 回退   | 改动全丢，工作区也对齐到上个提交  |

一句话记：`soft` 改动还在暂存区（最温柔），`mixed` 改动回工作区（默认），`hard` 改动全没（最狠）。

### 三个典型场景

**1. 提交信息写错了，想改完重新提交** —— 用 `--soft`

```bash
git reset --soft HEAD~1
git commit -m "正确的提交信息"
```

改动全留在暂存区，直接重新提交即可。

**2. 多提交了文件，想重新挑** —— 用 `--mixed`（或不写模式）

```bash
git reset HEAD~1 # 改动回到工作区
git add <只要的文件>
git commit -m "..."
```

**3. 这次提交和改动都不要了** —— 用 `--hard`

```bash
git reset --hard HEAD~1
```

> ⚠️ `--hard` 会把**未提交过的工作区改动**也一起清掉，且这部分找不回来。已经 commit 过的内容靠 reflog 还能恢复，但没 commit 的改动是真没了。拿不准就先用 `--mixed`，至少改动还在。

### 回退多个提交

```bash
git reset --soft HEAD~3 # 回退最近 3 个提交，改动全留暂存区
```

## commit --amend：只修补最近一次

如果只是想改**最近一次提交**（改提交信息，或补一个漏掉的文件），不用 reset，用 `--amend` 更直接：

```bash
# 改提交信息
git commit --amend -m "新的提交信息"

# 补一个漏提交的文件
git add <漏掉的文件>
git commit --amend --no-edit # --no-edit 保持原提交信息
```

`--amend` 是"原地修改最近一次提交"，本质是新建一个提交替换掉 HEAD。它**只能改最近一次**，要整理多个提交得用 `rebase -i`（见 [rebase 和 merge 怎么选？](./git-rebase-merge.html)）。

> `--amend` 同样只适合本地未 push 的提交。已 push 的提交 amend 后再 push 会被拒，得 force push，等于改写了公共历史。

## revert：已 push 的提交怎么撤

提交已经 push 到别人会拉的分支，不能用 reset 改写历史，要用 `revert`——它**新建一个反向提交**来抵消，历史里两个提交都在，但效果抵消：

```bash
git revert <坏提交的 sha>
git push
```

同事 pull 下来不会炸，CI / 审计也看得到"谁撤销了什么"。这是公共分支的安全反向，详见 [线上回滚和 Git 回退怎么配合？](./git-rollback-release.html)。

## reflog：误操作的救生圈

`reset --hard` 撤掉的提交不是真没了，Git 会在 reflog 里记下所有 HEAD 的移动：

```bash
git reflog
# 输出形如：
# f7e9ac5 HEAD@{0}: reset: moving to HEAD~1
# a1b2c3d HEAD@{1}: commit: 坏提交
```

找到要回到的那个状态，恢复：

```bash
git reset --hard a1b2c3d # 回到"坏提交"还在时的状态
```

> reflog 是安全网，不是日常流程。而且它只保留一段时间（默认 90 天可达、30 天不可达），且**只对已 commit 过的内容有效**——没 commit 过的工作区改动，`--hard` 之后 reflog 也救不回来。

## cherry-pick：从别处摘一个提交过来

整理提交时还常用 `cherry-pick`：把某个分支上的单个提交"摘"到当前分支，不动其他提交：

```bash
git cherry-pick <提交 sha>
```

典型场景：在 feature 分支修了个 bug，想单独把这次修复先拿到 main，但不合整个 feature。cherry-pick 那一个提交即可。

## 场景速查

| 我想                         | 还没 push 用                               | 已 push 用                   |
| ---------------------------- | ------------------------------------------ | ---------------------------- |
| 改最近一次提交信息           | `commit --amend`                           | `revert` + 新提交            |
| 撤销最近一次提交（保留改动） | `reset --soft/mixed HEAD~1`                | `revert <sha>`               |
| 撤销最近一次提交（丢弃改动） | `reset --hard HEAD~1`                      | `revert <sha>`               |
| 合并最近几次提交             | `reset --soft HEAD~N` 后重提 / `rebase -i` | 只能 `revert` 或新建整理提交 |
| 把别处的某次提交拿过来       | `cherry-pick <sha>`                        | `cherry-pick <sha>`          |

## 容易踩的坑

1. **已 push 的提交用 reset --hard + force push**：改写了别人已经基于开发的历史，所有人 pull 都会冲突，等于制造事故。公共分支一律用 revert。
2. **--amend 当日常修改用**：`--amend` 改的是最近一次提交，不是"追加提交"。已 push 的提交 amend 后必须 force push，慎用。
3. **reset --hard 丢了未提交改动**：工作区没 commit 的改动，`--hard` 后找不回。拿不准先 `git stash` 暂存，再 reset。
4. **revert 合并提交忘了 -m**：撤销 merge commit 要指定主线父 `-m 1`，否则报错或方向反。
5. **以为 reflog 永久**：reflog 有保留期，且本机独立，不随 push 同步，换机器 / 克隆就没了。重要的状态还是靠分支或 tag 固化。

## 小结

- 撤销提交前先判断"有没有 push"：本地可改写历史（reset / amend / rebase -i），公共分支只能 revert。
- reset 三模式看改动去留：`--soft` 留暂存区、`--mixed` 回工作区、`--hard` 全丢；拿不准用 `--mixed`。
- 改最近一次提交信息或补文件用 `commit --amend`，但只适合本地未 push。
- 已 push 的提交用 `revert` 新建反向提交，不改写历史。
- `reset --hard` 误操作靠 `reflog` 找回已 commit 的状态，但未 commit 的工作区改动找不回。

## 参考

本文综合 Git 官方文档（git-reset、git-commit、git-revert、git-reflog 手册）与公开 Git 教材，核对了 reset 三种模式的改动去留、--amend 与 reset 的边界、revert 在公共分支的作用，并对照了与线上回滚的分工。
