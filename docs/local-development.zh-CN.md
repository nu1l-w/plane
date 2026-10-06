# Plane 本地开发与使用指南

## 先分清两套环境

| 目录          | 用途                                     | 入口                  |
| ------------- | ---------------------------------------- | --------------------- |
| `plane-src`   | 当前使用的源码开发环境，可改代码并热更新 | http://localhost:3000 |
| `plane-local` | Docker 成品镜像环境，目前已停止          | http://localhost:8080 |

两套环境的数据库、账号、项目和附件独立，不会自动同步。这里的命令只操作 `plane-src`，不会迁移或删除 `plane-local` 的数据。

## 日常启动与停止

先打开 Docker Desktop，等待 Docker 引擎启动。终端进入源码目录：

```bash
cd "/Users/nu1l/Code/Project Management/plane-src"
bash dev.sh up
bash dev.sh frontend
```

- `up` 后台启动数据库、缓存、队列、对象存储、API 和后台任务，并运行数据库迁移。
- `frontend` 前台启动 Web、Admin、Space、Live。保持终端开启，关闭时按 `Ctrl+C`。
- 脚本会自动使用这台机器已有的 `../.tooling/node-v22.22.0-darwin-arm64/bin`，无需修改系统 Node。
- 当前服务已经启动时，直接打开页面即可，不要重复启动前端，否则可能端口冲突。
- 新机器需要 Node >= 22.18、项目指定版本 pnpm、前端依赖和各应用 `.env`。此脚本用于管理已配置的环境，不负责首次安装。

在另一个终端查看状态、日志或停止后端：

```bash
bash dev.sh status
bash dev.sh logs api worker plane-minio
bash dev.sh down
```

`logs` 按 `Ctrl+C` 仅退出日志查看，不会停服务。`down` 保留数据卷，前端仍需在原终端按 `Ctrl+C`。

**不要执行 `docker compose down -v` 或 Docker 的卷清理操作**，它们可能删除数据库和附件。Docker 卷不是备份，重装 Docker 前应单独备份 PostgreSQL 和 `uploads` 卷。

## 访问地址

| 地址                                 | 用途                                   |
| ------------------------------------ | -------------------------------------- |
| http://localhost:3000                | 日常项目管理                           |
| http://localhost:3001/god-mode/      | 实例管理员后台，配置注册、邮件等       |
| http://localhost:3002/spaces/        | 发布的项目空间，不是日常工作入口       |
| http://localhost:8000/api/instances/ | API 状态检查                           |
| http://localhost:9090                | MinIO 对象存储控制台，仅排查附件时使用 |

MinIO 的账号、密码对应根目录 `.env` 的 `AWS_ACCESS_KEY_ID` 和 `AWS_SECRET_ACCESS_KEY`，不是 Plane 登录账号。不要在控制台随意删除桶或对象。

## 登录与创建第一个项目

当前源码环境已完成实例初始化，且已有工作区，无需重新安装。

1. 打开 http://localhost:3000，输入之前在源码环境注册的邮箱，点击 **Continue**，按页面提示输入密码。
2. 没有账号时选择 **Sign up**。当前已允许注册，支持邮箱和密码登录。
3. 登录后，选择已有工作区，或通过工作区切换菜单创建 **Workspace**。
4. 进入 **Projects**，创建项目，填写名称及标识符。例如名称 `Sonicore`，标识符 `SONIC`；任务会显示为 `SONIC-1` 等编号。
5. 进入项目的 **Work items / Issues**，创建任务，填写标题、描述、状态、优先级、负责人和截止日期。
6. 切换为看板视图，通过拖动任务推进状态。任务详情中可以评论、添加子任务和上传附件。

如果登录后看不到之前的项目，先确认它是在 `plane-src:3000` 还是 `plane-local:8080` 创建的，不要通过删库重建来排查。

## 怎么组织工作

| 概念                   | 用法                       | Sonicore 示例                 |
| ---------------------- | -------------------------- | ----------------------------- |
| Workspace 工作区       | 一个团队或产品的总空间     | Sonicore 团队                 |
| Project 项目           | 独立产品或工作方向         | 音频检测平台                  |
| Work item / Issue 任务 | 一件可交付、可验收的工作   | 完成 YAMNet 原始录音基线报告  |
| Module 模块            | 一组相关任务               | 数据与标注、检测模型、动态 EQ |
| Cycle 迭代             | 一个有起止时间的执行周期   | 第一轮两周迭代                |
| Page 文档              | 需求、实验报告、会议记录   | 基线报告与验收标准            |
| View 视图              | 保存筛选条件，集中查看任务 | 本周到期、分配给我、阻塞任务  |

建议先建一个项目和三个任务：整理录音样本、完成基线评估、验证动态 EQ。每个任务都写清楚“要做什么、验收结果、截止日期”，再逐步引入模块和迭代。

成员邀请在工作区设置的成员管理中操作，进入私有项目可能还需加入项目成员。当前没有配置 SMTP，邀请邮件、密码找回邮件不能当作已可用功能；团队正式使用前先到管理员后台配置并测试邮件。个人试用直接使用邮箱密码登录即可。

## 附件上传与限制

- 任务附件、头像和图片使用 MinIO 存储，不需要手动登录 MinIO 上传。
- 当前实例单文件上限为 **5 MiB（5,242,880 字节）**。较大的游戏音频录音应放在专门的数据存储中，在任务里附链接；短样本可作为附件上传。
- 建议在一个测试任务里上传小文件，再点击下载确认。图片应使用对应的头像或图片入口，普通文件使用附件入口。
- 当前已验证真实签名上传、下载、后台元数据读取、浏览器跨域响应，以及未签名访问被拒绝。并未逐项手工验收所有页面的附件入口。

## 这次修复了什么

1. 本地 Compose 默认复用已有的 `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`，避开原 Quay 镜像的拉取问题。这是第三方构建，供本机开发使用，不代表生产环境供应链审查已完成。
2. MinIO 使用正常的前台服务进程和健康检查；独立的 `minio-init` 服务在存储就绪后创建私有桶，失败时不再被忽略。
3. 后端通过 `http://plane-minio:9000` 访问存储，签名上传和下载通过浏览器可访问的 `http://localhost:9000`。后台导出的下载签名也支持这个公开地址。
4. 本地 Compose 使用 `USE_MINIO=0` 的直接 S3 模式。这不表示关闭 MinIO，而是避免使用需要反向代理的同域地址模式。
5. MinIO 的 9000、9090 端口只绑定本机。数据库和 API 仍属于开发配置，不能直接作为公网部署使用。

根目录 `.env` 可选配置：

```dotenv
MINIO_IMAGE=pgsty/minio:RELEASE.2026-08-04T00-00-00Z
AWS_S3_PUBLIC_ENDPOINT_URL=http://localhost:9000
```

不填写时使用 Compose 默认值。替换镜像时需兼容 `minio`、`mc` 和 `curl`。这些地址只适用于本机使用；局域网共享还需统一前端地址、CORS、端口绑定及安全配置，不能只改一个 URL。

本地 Compose 会统一覆盖 API、worker 等服务的存储配置，因此仅修改 `apps/api/.env` 中的存储地址不会改变本地 Compose 的实际值。

## 常见排查

```bash
# 容器是否正常
bash dev.sh status

# API 与存储日志
bash dev.sh logs api worker plane-minio minio-init

# 对象存储是否可达，应返回 HTTP 200
curl -I http://localhost:9000/minio/health/live
```

- `migrator` 和 `minio-init` 是一次性任务，显示 `Exited (0)` 正常。
- 3000 打不开：检查前端终端是否仍在运行；只有 Docker 后端启动不够。
- 上传失败：确认 MinIO 健康、文件未超过限制，并查看浏览器网络请求及 API/worker 日志。
- 修改容器环境变量：重新执行 `bash dev.sh up`，仅 `restart` 不会加载新变量。
- 修改前端环境变量：停止前端，再执行 `bash dev.sh frontend`。
- 后端代码通常由 API 自动重载；修改 Celery 任务代码后需重启 worker。
- 原镜像无法拉取时：在根目录 `.env` 配置可获取且受信任的兼容镜像，再执行 `up`。不要为了重新拉镜像删除数据卷。

## 钉钉 / 飞书通知服务

配置 `services/notification-adapter/.env` 后，`bash dev.sh up` 自动启用通知服务，Docker Desktop 中归入 `plane-src` 分组；`bash dev.sh down` 一起停止，队列数据保留。不配置该文件时，不启动通知服务。

现有 Webhook 地址 `http://host.docker.internal:8080/webhooks/plane` 可继续使用，API / worker 的 `WEBHOOK_ALLOWED_HOSTS` 需包含 `host.docker.internal`。通知配置修改后运行 `bash dev.sh up`；通知代码修改后运行 `docker compose -f docker-compose-local.yml --profile notifications up -d --build notification-adapter`。查看日志使用 `bash dev.sh logs notification-adapter`。
