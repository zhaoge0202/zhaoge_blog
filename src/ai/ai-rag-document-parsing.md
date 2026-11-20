---
title: "PDF、OCR 和正文怎样变成可引用的 RAG 证据？"
description: "从阅读顺序、页码与标定样例建立文档解析的证据质量链路。"
breadcrumb: true
article: true
editLink: false
category:
  - "AI 应用开发"
tag:
  - "项目实战"
  - "进阶"
prev:
  {
    text: "Embedding 和 Reranker 有什么区别，怎样用业务样本选型？",
    link: "/ai/ai-embedding-reranker.html",
  }
next:
  {
    text: "表格和 Excel 怎样保住字段关系，并支持可靠查询？",
    link: "/ai/ai-rag-table-evidence.html",
  }
---

# PDF、OCR 和正文怎样变成可引用的 RAG 证据？

> 文档解析要保住正文、顺序、条件与来源，再经过质量检查，才能作为可引用的检索证据。

## 原政策没有错，为什么助手解释成了相反意思？

假设工单助手查询 T-1048 的升级政策，原文左栏写着一般条件及例外，右栏是另一产品的处理说明。
提取器却按屏幕上相近的高度交替拼接两栏，把例外接到了错误规则后面。
后续召回命中了工单关键词，模型仍可能得到一条结构已经损坏的“证据”。

另一份扫描件把 `T-1048` 识别成 `T-I048`，标题和段落都很流畅，关键对象却变了。
这些是教学假设，说明解析问题可能发生在索引和模型调用之前。
排查时应先回看原页，再决定是否调整检索或生成配置。

## 原生 PDF、有文字层的扫描件和纯图片，怎样分流？

原生 PDF 通常可以提取字符及位置，但 PDF 主要描述页面绘制，文本存储顺序未必对应阅读顺序。
纯扫描页需要识别图像中的文字，有 OCR 文字层的扫描件则可能已经藏着错误字符。
同一份文件还可能混合这几类页面。

因此要逐页记录文字覆盖和可读性，再决定直接提取、重新 OCR 或送人工复核。
提取为空也可能来自字体映射、损坏或加密，不能直接认定该页是空白页。
存在大量字符同样不能证明文字层可靠。

解析前先检查实际格式、允许的大小与页数，限制解压、渲染、内存和执行时间。
文件名和 MIME 声明只提供线索，解析器还需验证结构，并按授权处理加密文件。
解析过程不执行文档中的宏、脚本或外部动作，隔离措施见[代码工具的执行边界](./ai-agent-sandbox-isolation.html)。

## PDFBox 提取了文本，为什么还要重建阅读顺序？

PDFBox 3.0.8 的 `PDFTextStripper#getText` 默认按页面内容流顺序提取文本。
`setSortByPosition(true)` 可以改用位置排序，但这并不提供完整的版面语义判断。
双栏的左右关系、浮动说明框和跨页段落仍需要布局与文档规则配合。

实践中可以先识别文本块、栏位和标题，再在各区块内部排序。
重复的页眉页脚应标记后处理，脚注、限定条件和章节标题则不能因为位置相近就一并删掉。
同一标题下跨页延续的条件，应保留续接关系及各页的定位信息。

PDFBox 的 `TextPosition` 提供字符位置和方向信息，可供上层重建区块。
不同方法对文字方向与页面旋转的处理不同，应用应明确坐标系并转换后再生成引用框。
不能把任意解析器返回的四个数直接画到浏览器页面上。

## OCR 输出怎样变成能够回查的记录？

Tesseract 的质量文档指出，图像尺度、旋转、背景、噪声和页面分割方式都会影响识别。
应对代表性样例逐项验证，不能把某个 DPI 或分割模式当成所有扫描件的最佳参数。
对于编号和金额，错一个字符就可能改变业务对象或结论。

原件和派生文本分别保留身份，提取结果还要说明解析版本、页面与质量状态。
下面的内部记录为教学示意，没有执行真实 OCR。

```json
{
  "sourceId": "ticket-policy",
  "revision": "r4",
  "page": 2,
  "blockId": "left-exception",
  "bbox": [36, 90, 270, 160],
  "coordinateSpace": {
    "unit": "pt",
    "origin": "top-left",
    "rotation": 0
  },
  "parseVersion": "pdf-pipeline-demo-v1",
  "text": "等待供应商反馈的工单，按供应商处理规则核验升级条件。",
  "quality": {
    "state": "REVIEW_REQUIRED",
    "checks": ["reading-order-unverified"]
  }
}
```

这里约定 `page` 是从 1 开始的物理页号，印刷页码需要另存，`bbox` 为左上和右下角。
缩放与旋转后展示原页时，要应用对应变换。
`quality` 是应用的审核状态，不是模型分数；OCR 置信度高也不保证顺序、限定条件或事实正确。

## 怎样用标定样例判断解析结果能不能发布？

先人工核定少量代表性原页，保存预期正文、区块顺序、关键字段和来源位置。
样例至少包含双栏、扫描编号、跨页条件和空输出，分别检查失败原因。
两种解析器结果一致可以增加排查线索，却不能代替与原件对照。

| 检查对象 | 工单政策的标定判据                           |
| -------- | -------------------------------------------- |
| 关键字段 | `T-1048`、适用产品、时间和单位没有丢失或错配 |
| 阅读顺序 | 左栏条件和例外保持关联，右栏说明没有穿插进来 |
| 来源定位 | 能回到正确版本、物理页和原文区域             |
| 完整性   | 例外、脚注与跨页延续有记录，缺页被明确标记   |

下面只演示对合成区块顺序的检查，可以独立交给 Node 执行。
区块标识来自人工标定，不是实际解析器必须输出的统一字段。

```javascript
const expected = ["left-condition", "left-exception", "right-summary"];
const orderMatches = (actual) =>
  actual.length === expected.length && actual.every((id, index) => id === expected[index]);

console.log(orderMatches(["left-condition", "left-exception", "right-summary"]));
console.log(orderMatches(["left-condition", "right-summary", "left-exception"]));
console.log(orderMatches([]));
```

输出依次是 `true`、`false`、`false`。
这个检查只能发现已标定的顺序偏差，不能评价任意文档的语义质量。
字符错误率、关键字段保真和顺序正确率应分别统计，并按文档类型观察，避免一个总平均值掩盖关键错识别。

## 解析失败或只有部分页面可用，怎样处理？

解析、校验和发布应有独立状态，损坏、空输出和关键条件缺失不能直接标记为可用。
暂时性故障可在限额内重试，确定性的乱码或布局错误可更换解析路径或进入人工复核。
更换解析版本后要重新运行标定样例，记录相较上一版的变化。

部分成功是否发布取决于业务要求。
政策恰好缺少例外页时，发布剩余正文可能更危险，应阻断相关规则或明确缺口。
允许局部发布时，也要保存不可用页面，并避免把文档摘要表述成已覆盖全文。

通过解析验收后，才按完整语义单元切分并进入索引发布流程。
当前租户和文档权限还要在正文送入重排服务、模型或其他处理器前复核，引用入口也要鉴权。
内容更新与撤权的后续处理见[知识库索引生命周期](./ai-rag-index-lifecycle.html)。

表格中的计算和字段关系继续看[表格证据](./ai-rag-table-evidence.html)，图像语义与原图回查见[视觉证据](./ai-rag-visual-evidence.html)。

## 小结

1. 逐页判断直接提取或 OCR 路径，空文本和已有文字层都需要检查，不能直接判定可用。
2. 位置排序只提供布局线索，阅读顺序、标题和跨页条件仍要重建并验收。
3. 每份证据保留来源版本、页码、区块、坐标系、解析版本和质量状态。
4. 用原件标定关键字段、顺序和完整性，OCR 置信度或解析器一致不能替代这些判据。
5. 失败和部分成功要有发布策略，正文进入外部处理器前仍需满足当前授权。

## 参考

综合仓库 `docs/` 下文档处理与切分、RAG 数据治理及调优资料，并于 2026-11-20 对照以下官方原文。
修正了“按坐标排序就恢复语义顺序”“双引擎一致就必然正确”和“部分页面可解析便应全部入库”等泛化。

- [PDFBox 3.0.8：PDFTextStripper](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/PDFTextStripper.html)
- [PDFBox 3.0.8：TextPosition](https://javadoc.io/static/org.apache.pdfbox/pdfbox/3.0.8/org/apache/pdfbox/text/TextPosition.html)
- [Tesseract：Improving the quality of the output](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)

本文仅运行合成区块的顺序检查，未对真实 PDF、OCR 引擎或企业文档测量准确率，未执行文档上传或索引发布。
