# Plane 项目架构与功能模块导航

更新日期：2026-09-30。本文以当前仓库的**已注册路由和实际目录**为准，作为“星轴科技研发管理平台”后续二次开发的代码导航；不以翻译文案、旧 service 或空组件推断某项功能已经可用。本文不是运行验收报告，具体功能上线前仍需检查接口、权限和端到端行为。

## 1. 总体架构

```text
浏览器
  ├─ apps/web   主工作台（React Router，默认 3000）
  ├─ apps/admin 实例管理后台（React Router，默认 3001）
  └─ apps/space 对外发布的项目空间（React Router，默认 3002）
         │
         ├─ apps/api Django + DRF（默认 8000）
         │    ├─ PostgreSQL：业务数据与迁移
         │    ├─ Redis/Valkey：缓存等
         │    ├─ RabbitMQ + Celery worker/beat：异步及周期任务
         │    └─ S3 兼容存储/MinIO：附件及导出
         └─ apps/live Express + Hocuspocus：页面实时协作及文档服务

packages/*：前端应用共用的类型、API client、状态、组件、编辑器和国际化
apps/proxy + deployments/*：入口代理及部署配置
```

根目录 `pnpm-workspace.yaml` 管理 `apps/*`（排除 Python `apps/api` 和代理 `apps/proxy`）及 `packages/*`；`turbo.json` 编排 build、dev、check。**主前端是 React Router 路由配置，不是 Next.js 文件自动路由**。服务端由 Django 管理，`apps/api/package.json` 不代表它属于 pnpm 工作区。

### 各应用入口

| 应用          | 用途                                           | 首先查看                                                                                      |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web/`   | 登录、工作区、项目和研发管理主界面             | `app/routes.ts` → `app/routes/core.ts`（`extended.ts` 当前为空）；`app/provider.tsx`；`core/` |
| `apps/admin/` | 实例设置、工作区管理、邮件、认证和 AI/图片配置 | `app/routes.ts`、`app/(all)/(dashboard)/`、`components/`                                      |
| `apps/space/` | 对外发布项目及其工作项的访问                   | `app/routes.ts`、`app/[workspaceSlug]/[projectId]/`、`components/`                            |
| `apps/live/`  | 文档协作、实时连接、文档及 PDF 导出            | `src/server.ts`、`src/controllers/`、`src/hocuspocus.ts`、`src/services/`                     |
| `apps/api/`   | Django API、权限、数据库、后台任务             | `plane/urls.py`、`plane/app/`、`plane/api/`、`plane/db/`                                      |
| `apps/proxy/` | Caddy 代理配置                                 | `Caddyfile.ce`、`Caddyfile.aio.ce`                                                            |

API 顶层 URL 在 `apps/api/plane/urls.py`：`/api/` 是站内 `plane/app`，`/api/v1/` 是对外 `plane/api`，`/api/public/` 服务 Space，`/api/instances/` 服务实例管理，`/auth/` 是认证；不要把这几套路由混为一谈。`plane/web/urls.py` 还提供根路径健康检查等。前端新增页面需在对应应用的 `app/routes.ts` 或 Web 的 `app/routes/core.ts` **显式注册**。

## 2. 一项功能如何穿过代码

```text
Web 路由 apps/web/app/routes/core.ts
  → apps/web/app/(all)/[workspaceSlug]/.../page.tsx + layout.tsx
  → apps/web/core/components/<领域>/
  → apps/web/core/store/<领域>/ 或 packages/shared-state/src/store/
  → apps/web/core/services/<领域>/ 或 packages/services/src/<领域>/
  → apps/api/plane/app/urls/<领域>.py → views → serializers/permissions
  → apps/api/plane/db/models/<领域>.py → migrations/
  → 必要时 apps/api/plane/bgtasks/、apps/live/src/
```

前端共享契约常见于 `packages/types/src/`、`packages/constants/src/`（含 `endpoints.ts`、`fetch-keys.ts`），通用函数在 `packages/utils/src/`。Web 的根 MobX store 见 `apps/web/core/store/root.store.ts`，装配与翻译、SWR Provider 见 `apps/web/app/provider.tsx`。**Web 自己的 `core/services` 和共享 `packages/services` 同时存在**，修改前先跟踪页面实际 import 和网络请求。

后端站内接口的注册表是 `plane/app/urls/__init__.py`；开放接口注册表是 `plane/api/urls/__init__.py`。各自有 `views/`、`serializers/`；站内权限见 `plane/app/permissions/`，共享权限工具见 `plane/utils/permissions/`。数据表改动从 `plane/db/models/` 和 `plane/db/migrations/` 入手，后台任务在 `plane/bgtasks/`，调度配置见 `plane/celery.py`。

## 3. 主要业务模块速查

本节表格采用简写：页面路径以 `apps/web/app/(all)/[workspaceSlug]/` 为基准（登录、账号和个人设置页面直接以 `apps/web/app/(all)/` 为基准）；`core/` 以 `apps/web/` 为基准；“后端”以 `apps/api/plane/` 为基准。`[workspaceSlug]`、`[projectId]` 等是**磁盘目录名**，括号目录如 `(projects)` 是组织用分组名，不直接构成 URL；同一单元格中省略的前缀沿用前一项。

| 模块                         | Web 页面及交互                                                                                                                                              | Web 状态/请求                                                                                                | Django 入口和模型                                                                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 登录、账号与成员             | `sign-up/`、`accounts/`、`settings/profile/`；`core/components/auth-screens/`、`core/components/account/`                                                   | `core/store/user/`、`core/services/auth.service.ts`、`user.service.ts`                                       | `authentication/`、`app/urls/user.py`、`app/views/user/`、`db/models/user.py`                                                       |
| 工作区与成员                 | `(projects)/page.tsx`（首页）、`(settings)/settings/(workspace)/`；`core/components/workspace/`、`home/`                                                    | `core/store/workspace/`、`core/store/member/`、`core/services/workspace.service.ts`                          | `app/urls/workspace.py`、`app/views/workspace/`、`db/models/workspace.py`                                                           |
| 项目与项目设置               | `(projects)/projects/(list)/`、`projects/(detail)/[projectId]/`、`(settings)/settings/projects/[projectId]/`；`core/components/projects/`、`project/`       | `core/store/project/`、`core/services/project/`                                                              | `app/urls/project.py`、`app/views/project/`、`db/models/project.py`                                                                 |
| 工作项（Issue）              | `projects/(detail)/[projectId]/issues/`、`(projects)/browse/`、`drafts/`；`core/components/issues/`、`comments/`、`relations/`                              | `core/store/issue/`（项目/迭代/模块/详情/草稿等）、`core/services/issue/`                                    | `app/urls/issue.py`、`app/views/issue/`、`db/models/issue.py`、`db/models/description.py`、`db/models/draft.py`                     |
| 状态、标签、估算及工作项类型 | `(settings)/settings/projects/[projectId]/states/`、`labels/`、`estimates/`、`work-item-types/`；`core/components/project-states/`、`labels/`、`estimates/` | `core/store/state.store.ts`、`label.store.ts`、`estimates/`、`core/services/issue/work-item-type.service.ts` | `app/urls/state.py`、`estimate.py`、`issue_type.py`；`db/models/state.py`、`label.py`、`estimate.py`、`issue_type.py`               |
| 迭代 Cycle                   | `projects/(detail)/[projectId]/cycles/`、`(projects)/active-cycles/`；`core/components/cycles/`                                                             | `core/store/cycle.store.ts`、`cycle_filter.store.ts`、`core/services/cycle.service.ts`                       | `app/urls/cycle.py`、`app/views/cycle/`、`db/models/cycle.py`                                                                       |
| 模块 Module                  | `projects/(detail)/[projectId]/modules/`；`core/components/modules/`                                                                                        | `core/store/module.store.ts`、`module_filter.store.ts`、`core/services/module.service.ts`                    | `app/urls/module.py`、`app/views/module/`、`db/models/module.py`                                                                    |
| 自定义视图与筛选             | `projects/(detail)/[projectId]/views/`、`(projects)/workspace-views/`；`core/components/views/`、`work-item-filters/`                                       | `core/store/project-view.store.ts`、`global-view.store.ts`、`core/services/view.service.ts`                  | `app/urls/views.py`、`app/views/view/`、`db/models/view.py`                                                                         |
| 页面、知识文档               | `projects/(detail)/[projectId]/pages/`、`(projects)/pages/`；`core/components/pages/`、`editor/`                                                            | `core/store/pages/`、`core/services/page/`，编辑器 `packages/editor`                                         | `app/urls/page.py`、`app/views/page/`、`db/models/page.py`；版本及协作相关 `bgtasks/page_*`、`apps/live/`                           |
| 需求入口 Intake              | `projects/(detail)/[projectId]/intake/`、`(settings)/settings/projects/[projectId]/features/intake/`；`core/components/inbox/`                              | `core/store/inbox/`、`core/services/inbox/`                                                                  | `app/urls/intake.py`、`app/views/intake/`、`db/models/intake.py`                                                                    |
| 首页、仪表板及分析           | `(projects)/page.tsx`、`dashboards/`、`analytics/[tabId]/`；`core/components/home/`、`analytics/dashboard-overview.tsx`                                     | `core/services/dashboard.service.ts`、`analytics.service.ts`；旧 `core/store/dashboard.store.ts` 仅供追溯    | `app/urls/analytic.py`、`app/views/analytic/dashboard.py`；首页偏好另见 `app/urls/workspace.py`                                     |
| 收藏、通知、便笺             | `(projects)/notifications/`、`stickies/`；`core/components/workspace-notifications/`、`stickies/`                                                           | `core/store/notifications/`、`favorite.store.ts`、`sticky/`                                                  | `app/urls/notification.py`、`app/views/notification/`、`db/models/notification.py`、`favorite.py`、`sticky.py`                      |
| 自动化、归档与导出           | `(settings)/settings/projects/[projectId]/automations/`、`(projects)/projects/(detail)/[projectId]/archives/`、工作区设置 `exports/`                        | `core/components/automation/`、`archives/`、`exporter/`；`core/services/*archive*`                           | `app/views/issue/archive.py`、`app/urls/exporter.py`、`db/models/exporter.py`、`bgtasks/issue_automation_task.py`、`export_task.py` |
| 附件及媒体                   | 工作项/页面上传组件 `core/components/issues/`、`pages/`、`editor/`                                                                                          | `core/services/file*.ts`、`core/store/editor/asset.store.ts`                                                 | `app/urls/asset.py`、`app/views/asset/`、`db/models/asset.py`、`settings/storage.py`、`bgtasks/file_asset_task.py`                  |
| 集成、Webhook、API Token     | 工作区设置 `webhooks/`、个人设置 `settings/profile/`；`core/components/integration/`、`web-hooks/`、`api-token/`                                            | `core/services/integrations/`、`webhook.service.ts`                                                          | `app/urls/webhook.py`、`app/urls/api.py`、`db/models/webhook.py`、`db/models/api.py`、`db/models/integration/`                      |

对外集成接口**另外**查看 `plane/api/urls/{work_item,project,cycle,module,state,issue_type,...}.py` 及相应 `views/`、`serializers/`；公开空间查看 `plane/space/urls/` 和 `plane/space/views/`。新增业务能力时，按需要判断这两套接口是否也应覆盖，不能只修改站内 `/api/`。

## 4. 共享包定位

| 包                                                          | 负责内容与常用位置                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@plane/types`                                              | 前后端数据契约的前端 TS 类型：`packages/types/src/{issues,project,cycle,module,page,workspace,...}` |
| `@plane/constants`                                          | 领域常量、端点、查询 key：`packages/constants/src/`，工作区常量见 `src/workspace.ts`                |
| `@plane/services`                                           | 可跨应用复用的 API 服务：`packages/services/src/`；注意 Web 另有 `core/services/`                   |
| `@plane/shared-state`                                       | 跨应用共享的 MobX 状态及筛选：`packages/shared-state/src/store/`                                    |
| `@plane/ui`                                                 | 通用 UI 组件、Storybook：`packages/ui/src/`                                                         |
| `@plane/propel`                                             | 新设计系统组件，按子路径导出：`packages/propel/src/`                                                |
| `@plane/editor`                                             | 富文本编辑与协作 UI：`packages/editor/src/{core,ce,ee}/`                                            |
| `@plane/i18n`                                               | 国际化加载、翻译 Hook：`packages/i18n/src/`                                                         |
| `@plane/utils`、`@plane/hooks`                              | 跨应用纯函数、通用 React Hook                                                                       |
| `@plane/decorators`、`@plane/logger`                        | 实时服务控制器装饰器及日志等基础设施                                                                |
| `packages/tailwind-config`、`typescript-config`、`codemods` | 样式/TS 配置与代码迁移工具，非业务功能                                                              |

中文文案**运行时**加载 `packages/i18n/src/locales/zh-CN/*.json`，英文键和生成类型来自 `src/locales/en/*.json` 与 `scripts/generate-types.ts`。另有 `packages/i18n/locales/`，不要仅修改那里就假设运行界面会生效；新增翻译后检查 `scripts/sync-check.ts`。品牌资产也分散于 `apps/{web,admin,space}/public/`、各应用组件/样式，以及 `apps/web/app/assets/`，应按实际引用核查。

## 5. 能力边界与定制注意点

- `apps/web/app/routes/extended.ts` 当前为空；文件名、翻译键、组件目录或旧版 service **都不等于已注册页面或有效 API**。
- `/dashboards` 当前显示只读的固定研发总览（仅统计当前用户可访问的非访客项目）；`/api/workspaces/<slug>/dashboard-overview/` 支持按项目、负责人及**创建时间**筛选，并提供逾期、7 天内到期、14 天未更新和高优先级未分配的分页明细。URL 保留筛选参数，列表可跳转工作项详情。项目完成率按 `已完成 / (总数 - 已取消)` 计算；近 8 周展示创建、当前完成以及当前逾期按截止周分布，**不能当作历史逾期快照**。它仍不等于官方付费版可新建多个仪表板的自由配置画布；旧自定义 Dashboard API 未注册，相关模型已在迁移 `0092` 中删除。
- Workspace Pages 已有页面和站内接口，但 collection/嵌套页等不能仅凭 `wiki.json` 宣称可用；项目页、工作区页和公开页权限范围不同。
- 工作项类型有模型与设置入口；`ProjectUserProperty` / `IssueUserProperty` 是用户显示偏好，**不是**可任意定义的业务字段。
- `State` 是项目状态模型；`core/components/workflow/` 的存在不代表已有可配置的状态转换规则或审批系统。`is_time_tracking_enabled` 字段也不等于完整工时记录与报表。
- 付费能力恢复的逐项调查与未完成事项见 `docs/paid-features-restoration-todo.zh-CN.md`；本文件只负责代码定位，不将 TODO 写成已交付能力。
- 现有仓库有未提交的开发中改动；上线判断以当时分支、迁移是否应用和测试结果为准，不能直接以本文代替验收。

## 6. 后续二次开发的标准路径

1. **确定入口与范围**：在 `app/routes/core.ts` / `admin/app/routes.ts` / `space/app/routes.ts` 找到真实页面；对照产品所需权限和可见性。
2. **追踪数据链路**：从页面 import 找组件、store、service、endpoint，再查对应的 `app/urls` / `api/urls`、视图、serializer、权限、模型；对新增字段同步核对 TS 类型及迁移。
3. **区分作用域**：工作区/项目/公开空间/外部 API 分别检查访问控制；前后端控制都需要，不能只隐藏按钮。
4. **补齐横向能力**：中文文案、品牌、共享 UI、通知、附件、实时协作和后台任务只在功能涉及时接入；涉及定时任务检查 worker/beat 配置。
5. **测试与交付**：前端按所属包加单测并运行定向 `pnpm --filter=<包名> test`（如已配置）；后端按 `apps/api/tests/TESTING_GUIDE.md` 加 unit/contract 测试，使用 `docker-compose-test.yml`；再运行相关类型、lint、format 检查。先评估现有工作区改动，不覆盖或清理他人的改动。

本地启动及数据安全注意事项见 `docs/local-development.zh-CN.md`；根目录 `dev.sh` + `docker-compose-local.yml` 提供源码开发栈，`docker-compose-test.yml` 是隔离的 API 测试栈，生产/容器交付另见 `docker-compose.yml`、`deployments/{aio,cli,kubernetes,swarm}/` 和 `apps/proxy/`。**不要用 `down -v` 或清理卷作为普通调试手段**。
