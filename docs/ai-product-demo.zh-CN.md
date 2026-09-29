# 多端 AI 项目样板

这个样板是给你们这种同时维护多个产品端的团队准备的，重点不是做一个漂亮 demo，而是把下面三件事直接落到 Plane 里：

1. AI 功能应该优先落在哪些端。
2. 企业常用的排期与治理方式怎么映射到 Plane。
3. 打开后就能看到一个接近真实项目结构的样板。

## 这个项目能不能满足

可以，前提是你把它当作“项目协同底座”，而不是把所有 AI 逻辑都塞进 Plane。

Plane 比较适合承接这些事：

- 路线图和季度目标管理
- 双周 Cycle 排期
- 多端模块拆分
- 风险、依赖、灰度发布跟踪
- 文档、方案、周报、复盘沉淀
- 用标签区分 AI 能力、跨端联调、风险项、灰度发布

不适合直接承接的部分：

- 模型推理本身
- 向量检索服务
- 提示词运行时
- 在线评测服务

更合理的方式是：`Plane 管项目`，`业务系统做 AI 能力`，`AI 中台做模型/提示词/评测`。

## 大企业一般怎么做排期

常见做法可以压缩成这一套：

1. 季度先定 3-5 个一级目标，不让需求池无限膨胀。
2. 按产品线拆模块，例如 App、PC、Web、中台。
3. 按时间切 Cycle，例如双周一个 Cycle。
4. 每个需求都必须有目标、负责人、风险、验收口径。
5. 周会看偏差和风险，日会只处理阻塞。
6. 上线前单独管理灰度、监控、回滚。

在 Plane 里对应关系很直接：

- `Project`：一个季度或一个业务主题
- `Module`：颂娜 App / KNA App / KNA PC / iKF App / iKF PC / 木之穹声 Web / AI 中台
- `Cycle`：双周排期
- `Issue`：可交付任务
- `Page`：方案、里程碑、复盘、治理规则
- `Label`：AI能力、客服Copilot、跨端联调、灰度发布、风险项

## AI 功能优先放哪里

建议优先级：

1. `iKF App / iKF PC`
   客服摘要、问题分类、坐席 Copilot，ROI 最容易看见。
2. `颂娜 App`
   智能推荐、摘要、语音入口，最容易让用户感知 AI。
3. `KNA App / KNA PC`
   需求总结、知识问答、周报生成，先提高团队内部效率。
4. `木之穹声 Web`
   运营后台、实验开关、数据看板，支撑前面几个端持续优化。
5. `AI 中台与数据`
   提示词、模型路由、埋点、评测，保证 AI 项目能持续迭代。

## 已经加进去的实例

新增了一个 Django management command：

`create_ai_product_demo`

它会自动创建或复用：

- 一个工作区
- 一个“2026 多端 AI 产品协同项目”
- 8 个模块
- 3 个 Cycle
- 8 个标签
- 3 个项目页面
- 12 个贴近你们场景的样例任务

模块包括：

- 颂娜 App
- KNA App
- KNA PC端
- iKF App
- iKF PC端
- 木之穹声 Web端
- AI 中台与数据
- 项目治理与发布

## 使用方式

先确认创建人邮箱已经在 Plane 里注册过。

在 `plane-src/apps/api` 下执行：

```bash
python3 manage.py create_ai_product_demo \
  --creator-email "your-email@example.com"
```

如果你想把同事也一起加进去：

```bash
python3 manage.py create_ai_product_demo \
  --creator-email "your-email@example.com" \
  --member-emails "pm@example.com,rd@example.com,qa@example.com"
```

如果你想换工作区或项目名称：

```bash
python3 manage.py create_ai_product_demo \
  --creator-email "your-email@example.com" \
  --workspace-slug "sonicore-ai-demo" \
  --workspace-name "Sonicore AI 协同样板" \
  --project-name "Q4 多端 AI 能力推进"
```

## 导入后建议先看哪里

1. `Pages`
   先看 AI 功能落点地图和治理规则。
2. `Modules`
   看每个端分别承担什么。
3. `Cycles`
   看双周节奏怎么排。
4. `Work items`
   按 `state` 或 `module` 分组看任务拆分。

## 你们团队怎么用会更顺

- 每个 AI 需求都挂一个业务指标，不要只写“接入 AI”。
- 任务粒度尽量控制在 1 到 3 天。
- 需要跨端联调的需求，必须同时挂 `跨端联调` 标签。
- 上线类任务必须挂 `灰度发布` 和 `风险项`。
- 每个 Cycle 结束后，在 Page 里写复盘，不要只在群里说。
