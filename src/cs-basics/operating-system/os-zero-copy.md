---
title: "零拷贝到底少拷了什么？"
description: "从传统文件传输、mmap、sendfile 和 DMA 讲清零拷贝。"
breadcrumb: true
article: true
editLink: false
category:
  - "操作系统"
tag:
  - "高频"
  - "原理深入"
  - "项目实战"
prev:
  text: "select、poll、epoll 的区别是什么？"
  link: "/cs-basics/operating-system/os-io-multiplexing.html"
next:
  text: "Reactor 模型为什么支撑 Netty？"
  link: "/cs-basics/operating-system/os-reactor-netty.html"
---

# 零拷贝到底少拷了什么？

> 零拷贝不是一次拷贝都没有，而是尽量避免数据在用户态和内核态之间来回搬运，减少 CPU 参与的数据复制。

## 传统文件传输有几次拷贝？

最普通的文件发送代码类似：

```c
read(file, buf, len);
write(socket, buf, len);
```

数据路径大致是：

```text
磁盘 -> 内核 Page Cache -> 用户缓冲区 -> socket 缓冲区 -> 网卡
```

这里通常有 4 次数据搬运：磁盘到内核、内核到用户、用户到 socket、socket 到网卡。其中设备和内存之间常由 DMA 完成，内核/用户之间的搬运会消耗 CPU，还伴随两次系统调用带来的 4 次用户态/内核态切换。

## mmap + write 少了什么？

`mmap` 把文件页映射到用户空间，应用不用再通过 `read` 把数据从内核 Page Cache 拷贝到用户缓冲区。

路径变成：

```text
磁盘 -> 内核 Page Cache ==映射== 用户空间 -> socket 缓冲区 -> 网卡
```

它减少了一次内核到用户的数据拷贝，但仍然需要 `write`，也仍然需要把数据送到 socket 缓冲区。

## sendfile 少了什么？

`sendfile` 把“读文件”和“写 socket”合并成一个系统调用，数据不用进入用户空间：

```text
磁盘 -> 内核 Page Cache -> socket 缓冲区 -> 网卡
```

如果网卡支持 scatter-gather DMA，内核可以把缓冲区描述信息交给网卡，进一步避免 Page Cache 到 socket 缓冲区的数据复制。此时 CPU 主要负责描述和调度，不再搬运大块文件内容。

这就是常说的零拷贝：少的是用户态/内核态之间不必要的数据拷贝，以及部分 CPU 内存拷贝。

## 哪些项目会用到？

- Kafka 文件日志发送常通过 Java NIO `FileChannel#transferTo` 利用底层 `sendfile`。
- Nginx 静态文件传输可以开启 `sendfile on`。
- Netty 提供 `DefaultFileRegion` 等能力来利用零拷贝发送文件。

这些场景有共同点：数据从文件到网络，中间不需要业务代码逐字节加工。如果要压缩、加密、改写内容，就很难完全走 sendfile 路径。

## 零拷贝什么时候不一定合适？

零拷贝常依赖 Page Cache。传输大量冷大文件时，Page Cache 可能被大文件冲掉，影响热点小文件或数据库缓存命中。某些大文件场景会考虑 Direct IO、异步 IO 或专门的缓存策略。

所以不要把零拷贝答成“所有文件 IO 都更快”。它适合文件内容不加工、顺序传输、能利用 Page Cache 的场景。

## 小结

- 传统 `read + write` 会让数据在内核缓冲区、用户缓冲区和 socket 缓冲区之间多次搬运。
- `mmap + write` 少一次内核到用户的数据拷贝。
- `sendfile` 合并系统调用，并避免文件内容进入用户空间。
- 支持 SG-DMA 时，可以进一步减少 CPU 参与的内核内拷贝。
- Kafka、Nginx、Netty 文件传输是零拷贝的典型落点。

## 参考

综合社区资料，并结合 Kafka、Nginx、Netty 的文件传输场景做了边界化整理。
