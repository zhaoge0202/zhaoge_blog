---
title: "工业物联网"
description: "工业物联网专题，讲 PLC 与串口通信、设备接入链路、MQTT 上行与时序数据存储。"
article: false
breadcrumb: true
editLink: false
prev:
  text: "线程飙高、CPU 打满、死锁怎么标准排查？"
  link: "/high-availability/high-availability-thread-cpu-troubleshooting.html"
next:
  text: "设备接入平台的整体链路怎么搭？"
  link: "/iot/iot-device-access-overview.html"
---

# 工业物联网

这一栏讲"下位机那一侧"的工程知识：现场总线怎么读写、设备数据怎么组织成流、断网和丢包怎么兜住、采集数据存到哪。它补的是纯互联网背景最容易空的那一块——**对端设备改不了、网络不可靠、数据错了没有下游能替你纠正**。

## 题目列表

- [设备接入平台的整体链路怎么搭？](./iot-device-access-overview.html) - 分层职责、点位模型、上下行不对称与交付工程。
- [Modbus 协议怎么读写寄存器？](./iot-modbus-protocol.html) - 四张数据表、功能码、帧结构、地址偏移与字序。
- [S7 协议怎么和西门子 PLC 通信？](./iot-siemens-s7-protocol.html) - TPKT/COTP 分层、连接协商、DB 寻址与优化块访问。
- [RS232、RS485 和串口编程要注意什么？](./iot-serial-rs232-rs485.html) - 电气差异、半双工方向控制、USB 转串口与 Java 落地。
- [设备数据粘包、丢包怎么兜住？](./iot-frame-parsing-reliability.html) - 组帧状态机、超时预算、补采、重连与数据质量标记。
- [MQTT 适合什么场景、QoS 怎么选？](./iot-mqtt-practice.html) - 发布订阅模型、QoS 语义代价、会话遗嘱与选型边界。
- [采集数据该存时序库还是 MySQL？](./iot-time-series-storage.html) - 数据形状估算、建模、降采样与保留策略。
