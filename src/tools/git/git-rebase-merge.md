---
title: "rebase 和 merge 怎么选？会带来什么风险？"
description: "从历史线性和冲突处理讲清 rebase 与 merge 的取舍。"
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
  text: "线上回滚和 Git 回退怎么配合？"
  link: "/tools/git/git-rollback-release.html"
---

# rebase 和 merge 怎么选？会带来什么风险？

> merge 保留分叉事实，rebase 重写提交历史。选哪个取决于你是否愿意改写历史，以及这段历史有没有被别人用过。

## 先把两个命令在干什么说清楚

假设主干是：

```text
A --- B --- C          main
       \
        D --- E        feature
```

`git checkout main && git merge feature` 之后大致变成：

```text
A --- B --- C ------- M   main
       \             /
        D --------- E
```

多出一个合并提交 `M`，左右两条线都还在，谁从谁分出去、何时合回来，历史里能看出来。

`git checkout feature && git rebase main` 之后是：

```text
A --- B --- C --- D' --- E'   feature（再 merge/fast-forward 回 main）
```

`D`、`E` 被“挪”到 `C` 后面，变成新的 `D'`、`E'`。提交哈希变了，看起来像一直在最新主干上开发。

所以核心差别不是“谁更高级”，而是：

| 维度       | merge              | rebase           |
| ---------- | ------------------ | ---------------- |
| 历史形状   | 保留分叉与合并点   | 尽量线性         |
| 原提交     | 哈希通常不变       | 被重放，哈希变   |
| 冲突时机   | 一次合并点集中处理 | 可能按提交逐个撞 |
| 对公共分支 | 安全               | 已推送后危险     |
| 可读性     | 合并图可能乱       | 日志更像时间线   |

## 什么时候用 merge

团队主干、`main`/`release` 这种多人共享的分支，默认用 merge 更稳：

```bash
git checkout main
git pull
git merge --no-ff feature/pay-refund
```

`--no-ff` 即便能快进也强制生成合并提交，方便以后按“这次需求合入”做回滚或审计。GitHub/GitLab 的 **Merge commit** 策略就是这个思路。

**Squash merge** 也常被用在合 PR：把功能分支一堆 WIP 压成主干上一个干净提交。历史更清，但丢了分支内细粒度演进；出事时只能整块 revert。

适用场景：

- 功能分支合入主干
- 需要保留“何时合了什么”的审计点
- 对方分支已经推到远端、别人可能基于它继续开发

## 什么时候用 rebase

rebase 的强项是**整理个人分支**，不是改写公共真相。

常见套路：功能开发中主干已前进，先把个人分支接到最新点上，再提 PR：

```bash
git checkout feature/pay-refund
git fetch origin
git rebase origin/main
# 有冲突就解决后：
git add .
git rebase --continue
# 确认无误
git push --force-with-lease
```

`--force-with-lease` 比裸 `--force` 安全：远端若有别人新推的提交，推送会被拒绝，避免默默覆盖。

交互式 rebase 适合提 PR 前打扫提交：

```bash
git rebase -i origin/main
```

在编辑器里把 `pick` 改成 `squash`/`fixup`/`reword`，把“fix typo”“wip”压掉，只留下有语义的几个提交。**只对还没共享、或明确只有自己在用的分支做这件事。**

## 冲突形态不一样

merge 冲突通常出现在“两边最终状态”的汇合点：你只面对一次三方合并结果。

rebase 是按顺序重放提交。`D` 冲突解决完继续放 `E`，`E` 可能又冲突。中间某次 resolve 错了，后面会在错误基础上继续堆，最后看起来“rebase 成功了”，业务却静默坏掉。

所以 rebase 后不要只看“命令退出码 0”，至少要：

```bash
git log --oneline origin/main..HEAD
./mvnw test   # 或项目对应测试
```

涉及支付、权限、并发的改动，再补一轮手工回归。

## 公共分支 rebase 的真实风险

已推送到共享远端的提交被 rebase 后，哈希全变。同事如果基于旧哈希开了分支：

```text
你：  A-B-C-D'（force push 后）
同事：A-B-C-D-E（还在旧 D 上开发）
```

同事再 pull/push 会陷入“历史对不上”的泥潭，常见表现：

- 莫名其妙的重复提交
- 需要 `pull --rebase` 或更糟的手工整理
- 有人用 `reset --hard` 粗暴对齐，丢本地未备份改动

因此硬规矩可以写成：

1. **已进入 `main`/`develop` 的历史：不要 rebase 重写**
2. **个人 feature 分支：可以 rebase，推送用 `--force-with-lease`**
3. **多人共用的长期 feature 分支：默认 merge 同步主干，别轮流 rebase**

有的团队约定“只允许 release manager 整理发布分支”，那是流程授权，不是 Git 本身变安全了。

## 和 CI、Code Review 的配合

线性历史让 `git bisect` 更好用：出了回归，二分时少被无意义 merge commit 干扰。这是 rebase/squash 派喜欢的理由。

反过来，merge commit 保留了“这次合入包含哪些讨论过的提交”，和 PR 编号、发布说明对齐时更直观。

实务上很多团队折中：

- 个人分支对主干：rebase 或 squash
- 主干之间（`develop` → `main`）：merge，保留发布节点
- 热修：从 tag 拉分支，修完 cherry-pick 或 merge 回各受维护线

没有放之四海都正确的唯一答案，**团队写进 CONTRIBUTING 比面试背口号有用**。

## 容易踩的坑

1. **把 rebase 当成“更高级的 merge”**  
   两者解决的问题不同。为了“历史好看”去改写别人正在用的提交，是事故温床。

2. **冲突时无脑选 ours/theirs**  
   rebase 场景下 ours/theirs 方向容易反直觉。先看 `git status` 和两边 diff，理解语义再选。

3. **rebase 到一半想放弃**

   ```bash
   git rebase --abort
   ```

   回到 rebase 开始前。已经 `--continue` 很远且搞乱了，再用 `reflog` 找回原点。

4. **在已部署的 tag 上 rebase**  
   线上制品对应的 commit 被改写后，问题复现与热修定位都会乱。tag 指向的对象应视为不可变。

5. **squash 后还想精细 revert 其中一笔**  
   压成一个提交后，只能整单撤销或手工逆补丁。提 PR 前想清楚粒度。

## 怎么在面试里答得干净

可以按“场景 → 选择 → 风险”三句话：

- 个人功能分支同步主干、整理提交：倾向 rebase，推送带 lease
- 合入公共主干、需要审计合并点：倾向 merge 或受控的 squash merge
- 已共享历史禁止默默 force push；冲突解决后必须用测试兜底

再补一句自己项目里的真实约定，比空谈“我们都用 rebase”可信。

## 小结

1. merge 保留分叉事实与合并节点；rebase 重放提交换线性历史，哈希会变。
2. 公共分支默认 merge；个人分支可以用 rebase 接主干、整理提交。
3. 已推送历史的 rebase 必须配合 `--force-with-lease`，且团队要知情。
4. rebase 可能逐提交冲突，错误 resolve 会造成“成功但逻辑坏了”。
5. 选哪个最终服从协作规范：可读性、审计、回滚成本，而不是个人审美。

## 参考

综合自 Git 官方文档中 merge/rebase 语义与常见团队协作约定，结合公共分支 force-push 事故场景整理；命令行为以当前主流 Git 为准。
