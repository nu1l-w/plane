# Ubuntu 服务器代码更新指南

适用于已经部署成功的实例：在 Mac Docker Desktop 上构建 `linux/amd64` 镜像，通过 Termius SFTP 上传到 Ubuntu，再导入并重建应用容器。服务器独立运行，本地电脑和 Termius 关闭后网站仍可使用。

## 部署文件与操作位置

| 位置            | 路径 / 用途                                            |
| --------------- | ------------------------------------------------------ |
| Mac 项目        | `/Users/nu1l/Code/Project Management/plane-src`        |
| Mac 镜像包      | `/tmp/plane-deploy/`，临时目录，长期保留的版本包应另存 |
| Ubuntu 项目     | `/root/plane-src`                                      |
| Ubuntu 上传目录 | `/root/`                                               |

服务器必须保留 `docker-compose.yml`、`docker-compose.amd64.yml`、`docker-compose.override.yml`、`.env` 和 `apps/api/.env`。本文所有服务器 Compose 命令都显式加载三个 YAML 文件。

普通代码更新只上传镜像包，不需要上传源码或重新生成环境配置。本文假定基础服务已运行，首次部署还需要下载并导入数据库等基础镜像，以及初始化服务器环境配置。

## 选择更新范围

| 修改内容       | 构建 / 打包镜像    | 更新服务                             |
| -------------- | ------------------ | ------------------------------------ |
| 主站前端       | `web`              | `web`                                |
| 实例管理页面   | `admin`            | `admin`                              |
| 公共项目页面   | `space`            | `space`                              |
| 实时协作       | `live`             | `live`                               |
| 后端与后台任务 | `api`              | `api worker beat-worker`，先执行迁移 |
| 代理镜像内配置 | `proxy`            | `proxy`                              |
| 共享包         | 所有使用该包的应用 | 对应服务；不确定时更新全部           |

数据库、Redis、RabbitMQ、MinIO 镜像没有变化时，不必重复上传。`docker image save` 打包所选镜像的完整内容，并非代码差异，因此只改一行代码也需要上传该应用镜像包。

## 更新前准备

完成与改动相关的检查和测试。后端、数据库或重要更新前，备份数据库、上传文件和服务器环境配置，保留上一个可用版本的镜像包。

服务器上可用以下命令备份 PostgreSQL 和配置（在 Termius 执行）：

```bash
cd /root/plane-src
backup_stamp=$(date +%Y%m%d-%H%M%S)
backup_dir="/root/plane-backups/$backup_stamp"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"

docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  exec -T plane-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$backup_dir/database.dump"
```

确认上一条命令成功后，复制配置：

```bash
cp .env "$backup_dir/root.env"
cp apps/api/.env "$backup_dir/api.env"
cp docker-compose*.yml "$backup_dir/"
chmod 600 "$backup_dir"/*
ls -lh "$backup_dir/database.dump"
```

这不包含 MinIO 上传文件；需要另行备份其对象数据或停写后备份 `uploads` 数据卷。将备份复制到服务器以外的安全位置，配置文件包含密码，不要提交到 Git。

## 示例：只更新 web 前端

### 1. Mac 构建

在 Mac 自带终端执行：

```bash
cd "/Users/nu1l/Code/Project Management/plane-src"

docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  build web
```

确认构建成功再继续，不需要使用 `--no-cache`，Docker 会复用缓存。

### 2. Mac 打包

```bash
mkdir -p /tmp/plane-deploy
update_stamp=$(date +%Y%m%d-%H%M%S)
update_archive="/tmp/plane-deploy/web-update-${update_stamp}.tar"

docker image save plane-custom/web:ubuntu -o "$update_archive"
```

确认打包成功后执行：

```bash
gzip "$update_archive"
ls -lh "${update_archive}.gz"
```

打包和压缩时可能没有输出，等待命令结束。使用时间戳避免覆盖旧版本包。

### 3. Termius SFTP 上传

连接目标服务器，在本地侧进入 `/tmp/plane-deploy/`，将刚生成的 `web-update-日期时间.tar.gz` 上传到服务器 `/root/`。找不到本地目录时，可在 Finder 按 `Command + Shift + G` 输入路径。等传输完成后再导入。

### 4. Ubuntu 导入

切换到 Termius 的服务器终端，替换为实际文件名：

```bash
docker image load -i /root/web-update-日期时间.tar.gz
```

导入只更新镜像，不会自动替换正在运行的容器。

### 5. Ubuntu 更新容器

```bash
cd /root/plane-src

docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  up -d --no-deps --no-build --pull never --force-recreate web
```

`--no-deps` 避免重建依赖服务；`--no-build --pull never` 使用导入的本地镜像；`--force-recreate` 替换应用容器。更新期间该应用会短暂中断，数据卷保留。

### 6. 验证

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  ps web
```

浏览器刷新网站，验证修改功能以及登录等主要流程。需要查看日志时：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  logs --tail=100 web
```

更新 `admin`、`space`、`live` 或 `proxy` 时，将示例中的服务名和镜像名替换为相应名称。

## 更新后端或全部应用

### Mac 构建和打包

仅更新后端时构建 `api`，并仅打包 `plane-custom/api:ubuntu`。API、worker、beat-worker、migrator 共用此镜像。

不确定影响范围时，构建全部应用：

```bash
cd "/Users/nu1l/Code/Project Management/plane-src"

docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  build web admin space api live proxy
```

成功后打包：

```bash
mkdir -p /tmp/plane-deploy
update_stamp=$(date +%Y%m%d-%H%M%S)
update_archive="/tmp/plane-deploy/plane-update-${update_stamp}.tar"

docker image save \
  plane-custom/web:ubuntu \
  plane-custom/admin:ubuntu \
  plane-custom/space:ubuntu \
  plane-custom/api:ubuntu \
  plane-custom/live:ubuntu \
  plane-custom/proxy:ubuntu \
  -o "$update_archive"
```

确认打包成功后执行 `gzip "$update_archive"`，通过 SFTP 上传，再在服务器用 `docker image load -i /root/实际文件名.tar.gz` 导入。

### Ubuntu 先迁移，再启动新版

选择维护时间，确认备份成功。在服务器执行以下命令停止应用写入，基础服务继续运行：

```bash
cd /root/plane-src

docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  stop api worker beat-worker live
```

使用新 API 镜像运行数据库迁移：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  run --rm --no-deps --pull never migrator
```

确认迁移退出码为 0 后继续。若迁移失败，保留日志并排查，不要启动新版或盲目重复迁移。

仅更新后端时：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  up -d --no-deps --no-build --pull never --force-recreate \
  api worker beat-worker
```

然后重新启动之前停止的 Live 服务：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  start live
```

更新全部应用时，改用：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.amd64.yml \
  -f docker-compose.override.yml \
  up -d --no-deps --no-build --pull never --force-recreate \
  api worker beat-worker web admin space live proxy
```

最后用相同三个 `-f` 参数执行 `ps -a` 和 `logs --tail=100 api worker beat-worker proxy live`，并验证网站、附件和实时协作。这里的迁移使用临时容器，旧的 `migrator` 容器状态不能证明本次迁移结果，应以本次命令输出和退出码为准。

## 配置更新、回退与注意事项

- Compose 文件发生变化时，上传相应 YAML，检查 `config --quiet` 后再应用。只改服务器环境变量时通常不必重新构建镜像，但需要重建对应容器；前端构建时注入的变量需要重新构建前端。
- 保留 `.env`、`apps/api/.env` 和服务器的 override 配置，不要使用 Mac 开发配置覆盖，不要重新生成生产密码。
- 不要执行 `docker compose down -v`，它会删除数据卷。测试栈的清理命令不能用于生产栈。
- 纯前端回退：导入上一版 web 包，再执行相同的 web 容器更新命令。后端含数据库迁移时，需要评估旧代码与新数据库结构是否兼容，必要时按备份恢复，不能只换回镜像。
- 新版验证通过前不要删除旧包、备份或执行镜像清理。
- 日常更新无需购买企业镜像服务。若以后更新频繁，可接入服务器能访问的镜像仓库，通过镜像层复用减少上传和下载量。
