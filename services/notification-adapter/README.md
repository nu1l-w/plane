# Plane 钉钉 / 飞书群通知适配服务

独立 Python 标准库服务，不修改 Plane 核心业务。接收签名 Webhook，持久化到 SQLite，再由单个后台线程发送机器人消息（钉钉 Markdown、飞书文本）。可同时发送到飞书、钉钉；默认监听工作项和评论。此版本不包含个人 @、免登、通讯录同步或聊天内操作。

## 本地开发统一启动

使用 `dev.sh` 时，配置本目录 `.env` 后，`bash dev.sh up` 会自动启动通知服务，`bash dev.sh down` 一起停止；它在 Docker Desktop 的 `plane-src` 分组内。无需另行 `docker run`。现有 `host.docker.internal:8080` 接收地址保持可用；队列使用 `plane-notification-data` 命名卷。详见 `docs/local-development.zh-CN.md`。

## 与本仓库根目录 Compose 一起部署

在仓库根目录执行：

```sh
cp services/notification-adapter/.env.example services/notification-adapter/.env
```

1. 在目标群创建自定义机器人，取得 Webhook 地址。开启加签时，将密钥填入对应的 `*_SIGN_SECRET`。如果设置关键词，确保关键词出现在通知中，例如 `星轴`（如原关键词为 `Plane`，请同步调整）。官方说明：[飞书](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)、[钉钉](https://open.dingtalk.com/document/orgapp/custom-robot-access)。
2. 在 `apps/api/.env` 的 `WEBHOOK_ALLOWED_HOSTS` 中追加 `notification-adapter`，保留原有条目。API 和 worker 都需要读到这个设置。
3. 重新创建 API、worker，使白名单生效：

```sh
docker compose -f docker-compose.yml up -d api worker
```

4. 用工作空间管理员账号进入 Plane「设置 → Webhooks」，创建地址为 `http://notification-adapter:8080/webhooks/plane` 的 Webhook，勾选工作项与评论事件，复制创建时显示的签名密钥。未启动适配服务前，测试投递失败属正常现象。
5. 编辑 `services/notification-adapter/.env`：填写 `PLANE_WEBHOOK_SECRET`、用户浏览器实际访问的 `PLANE_BASE_URL`，以及至少一个机器人地址和对应的签名密钥。Plane 的密钥与机器人密钥是两种不同凭证；不要填 API Token。
6. 启动适配服务：

```sh
docker compose -f docker-compose.yml -f docker-compose-notifications.yml up -d --build notification-adapter
docker compose -f docker-compose.yml -f docker-compose-notifications.yml logs -f notification-adapter
```

创建一个测试工作项，或修改状态、添加评论，确认群消息和任务链接可用。配置变更后使用相同命令重新创建容器。此配置仅在 Docker 网络内开放 8080，不发布主机端口，不需要公网域名或额外服务器。

此叠加文件针对仓库根目录的 `docker-compose.yml`。如果使用 `deployments/cli/community/docker-compose.yml`、自定义 Compose 或 Kubernetes，需要将适配服务接入 API、worker 可访问的网络，并调整构建路径、环境文件路径及 DNS 名称。不要直接将本例套用到不同部署目录。

## 过滤与消息内容

`NOTIFICATION_BRAND` 配置消息中的品牌名称，默认 `星轴研发`。钉钉通知采用中文 Markdown 格式，任务链接显示为「查看任务」。机器人发送者名称需要在钉钉群机器人设置里修改，Webhook 无法覆盖该名称。

- `PLANE_EVENTS`：逗号分隔的事件名，默认 `issue,issue_comment`。Plane Webhook 页面也要勾选对应事件。
- `PLANE_PROJECT_IDS`：可选项目 UUID 列表；为空则不筛选。带过滤时，无项目字段的事件（例如部分删除事件）会被跳过。
- 没有路由文件时，所有项目仍发送到 `.env` 配置的默认群。每个实例绑定一个 Plane Webhook 密钥；不同工作空间建议运行独立实例。
- 任务通知包含编号（例如 #42）、名称、状态、中文优先级、负责人、开始 / 截止日期、标签、操作人和链接，按事件实际提供的字段显示。更新通知附带状态、优先级、日期、名称等变更前后的值；负责人增减单独说明。评论通知显示去除 HTML 后的正文摘要（最多 300 字）。服务会缓存最近 30 天任务事件中的名称和编号供评论使用；尚未收到对应任务事件时，评论标题显示「任务评论」，不展示内部 UUID。删除事件以及缺少项目 / 工作项 ID 的事件链接指向工作空间。

## 不同项目发送到不同群

1. 每个目标群创建自定义机器人，取得地址和加签密钥。
2. 从项目页面 `/projects/项目UUID/…` 获取项目 ID。
3. 复制示例，在本地填写真实信息：

```sh
cp services/notification-adapter/config/routes.example.json services/notification-adapter/config/routes.json
```

`projects` 的键是项目 UUID，值为机器人数组。`platform` 为 `dingtalk` 或 `feishu`；`webhook_url` 是目标群机器人地址；未启用加签则 `sign_secret` 填空字符串。一项可以配置多个机器人。删除不需要的示例项目并替换占位符。此文件已加入 Git 忽略，勿提交密钥。

Docker 只读挂载配置目录，服务启动时自动读取 `routes.json`。**文件存在时，按项目路由；`.env` 默认群不再接收新事件。可在顶层 `all_projects` 数组配置接收所有项目的机器人**。全项目群会额外收到每个事件，专属群继续按项目接收。同一机器人在两处配置时只发送一次。没有全项目群时，未匹配项目及缺少项目字段的事件会跳过。当前 Plane 部分删除事件只有对象 ID，因此仅发送到全项目群；没有全项目群时跳过，不会发送到错误的专属群。项目事件使用其自身 ID 匹配。`PLANE_EVENTS`、`PLANE_PROJECT_IDS` 筛选继续生效。

本地应用路由修改：

```sh
docker compose -f docker-compose-local.yml --profile notifications restart notification-adapter
```

不用重新构建镜像；以后照常使用 `bash dev.sh up`。仅执行 `up` 不保证重启正在运行的容器，因此修改路由后请使用上述 `restart`。本机直接运行 Python 时，设置 `ROUTES_FILE=services/notification-adapter/config/routes.json`。

删除 `routes.json` 并重启，恢复 `.env` 默认群。路由文件格式错误或包含不允许的机器人地址时，服务启动失败，避免悄悄改发默认群。已排队的消息保留原目的地；移除或更换机器人地址后，旧消息不会改投新群，可能进入失败重试。更改同一地址的加签密钥后，旧消息使用新密钥。

## 投递与维护

HTTP 202 表示已写入队列，不表示机器人已收到。SQLite 位于 Docker 命名卷 `notification-data`，容器重启后继续处理；不要删除这个卷。单实例运行，勿多个容器共用队列文件。

网络错误、非成功业务码会重试，最多 8 次，间隔逐步增加。耗尽后保留 `failed` 记录并写日志，不会无限重试。各平台独立记录投递结果；某个平台失败不会让另一个平台重复发送。

查看队列状态：

```sh
docker compose -f docker-compose.yml -f docker-compose-notifications.yml exec notification-adapter python -c "import sqlite3; print(sqlite3.connect('/app/data/queue.sqlite3').execute('SELECT status, count(*) FROM jobs GROUP BY status').fetchall())"
```

修正机器人配置、重新创建容器后，可手动重试失败记录：

```sh
docker compose -f docker-compose.yml -f docker-compose-notifications.yml exec notification-adapter python -c "import sqlite3; db=sqlite3.connect('/app/data/queue.sqlite3'); db.execute(\"UPDATE jobs SET status='pending', attempts=0, due=0 WHERE status='failed'\"); db.commit()"
```

按 `X-Plane-Delivery` 和平台去重，成功记录保留七天。Plane 重新生成投递 ID、机器人已接收但网络超时，或进程在发送成功后写入状态前退出，仍可能重复消息；不承诺严格仅一次投递。

`GET /healthz` 检查 HTTP 服务存活；队列失败数需要另行监控。机器人凭证和数据库包含敏感信息，环境文件已忽略，Docker 构建只复制程序。若将服务对外开放，应通过有请求大小 / 连接数限制的 HTTPS 反向代理暴露。

## 本地运行与测试

Python 3.9+，无需 pip 安装依赖；本地运行不会自动读取 `.env`，应由启动环境注入变量：

```sh
python3 services/notification-adapter/app.py
python3 -m unittest discover -s services/notification-adapter -v
```

测试使用临时数据库及模拟机器人响应，不调用真实机器人。HTTP 接收测试会绑定本机临时端口。
