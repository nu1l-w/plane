# Plane 付费功能还原 TODO

最后更新：2026-09-30

## 目标

基于当前开源仓库能力，梳理 Plane 付费版与开源版的主要差距，并形成一份面向内部定制项目的可执行 TODO 清单。

本清单的目标不是 100% 复刻 Plane 官方付费版，而是优先恢复对“星轴科技研发管理平台”最有价值、且在当前仓库中已有实现基础的能力。

## 结论摘要

- `Pro` 级核心体验可还原，整体难度为中等。
- `Business` 级治理能力可部分还原，但难度会明显上升。
- `Enterprise` 级权限、认证和组织治理能力不建议优先投入，整体难度高。

## 差距总览

### 开源版现有主体

- Projects / Work Items
- Cycles / Modules / Views
- 项目级 Pages
- 基础 Estimates
- 基础 Intake

### 付费版主要增量

- `Pro`：Dashboards、Workspace Wiki、自定义 Work Item Types / Properties、Time Tracking、Templates、Teamspaces、Initiatives、更多集成
- `Business`：Workflows + Approvals、Customers、Intake Forms / Intake Email、Nested Pages、Recurring Work Items、进阶报表
- `Enterprise`：RBAC / GAC、SSO / SAML / LDAP、审计、安全与实例级治理

## 还原分级

### A 级：优先恢复，投入产出比最高

#### 1. Dashboards

状态判断：

- 已将工作区侧边栏 `/dashboards/` 与个人首页分离，新增固定研发总览：项目/工作项总数、已完成、进行中，以及项目进度与状态分布。
- 风险卡片可打开分页工作项明细：逾期、未来 7 天到期、14 天未更新（按工作项 `updated_at`）和高优先级未分配；可进入任务详情。按项目、负责人（含未分配）、创建时间筛选，URL 可保存/分享当前条件；风险分类允许重叠。
- 已增加近 8 周的新增、当前完成与当前逾期（按截止周）图；逾期图不是历史每周逾期存量。项目完成率排除已取消项，工作项总数仍包含取消项；“14 天未更新”不计评论活动，负责人及创建时间筛选限定工作项集合，但不改变可访问项目数。页面提供这些口径说明。
- 总览数据来自只读 `/api/workspaces/<slug>/dashboard-overview/`，仅汇总当前用户拥有有效项目管理员/成员资格的未归档项目；API 合约测试已覆盖越权、访客项目、筛选及分页。
- 个人首页 widget 仍走 `home-preferences` API，保留快速链接、近期动态和便笺。
- 旧版自定义 Dashboard service 指向的 `/api/workspaces/:slug/dashboard/`、`/api/dashboard/:id/` 等接口没有注册；相关旧模型先改名为 `Deprecated*`，再被迁移 `0092` 删除。
- 当前交付的是**固定研发总览**，不是 Pro/Business 可创建多个仪表板、保存过滤器、拖放或编辑统计 widget 的完整功能。

代码线索：

- `packages/services/src/dashboard/dashboard.service.ts`
- `apps/web/core/components/analytics/dashboard-overview.tsx`
- `apps/api/plane/app/views/analytic/dashboard.py`
- `apps/api/plane/db/migrations/0092_alter_deprecateddashboardwidget_unique_together_and_more.py`

TODO：

- [x] 盘点 Dashboard 页面入口、菜单入口、权限开关
- [x] 确认当前首页 widget 使用的后端接口；旧自定义 Dashboard API 未注册，不能只按隐藏入口处理
- [x] 恢复 Workspace/Home Dashboard 可见性
- [x] 实现固定研发总览、中文文案与项目作用域测试
- [x] 增加风险分类、可跳转分页明细及项目/负责人/创建时间筛选
- [x] 增加近 8 周趋势与完成率、未更新和时间筛选的口径说明
- [ ] 若需复刻官方付费版，再设计仪表板/小部件持久化、可配置聚合、权限和拖放布局

固定总览难度：中；完整自定义仪表板难度：高

#### 2. Workspace Wiki / Workspace Pages

状态判断：

- Workspace pages、shared pages、private pages、wiki collections 等文案与结构都较完整。
- 后端权限代码里明确预留了 feature flag 覆盖点。
- 已新增 workspace-level 页面列表/创建/详情/编辑、描述内容、版本列表/详情/恢复 API，并接入 `/workspaceSlug/pages` 列表与编辑器路由。
- 已采用“共享页工作区成员可读、所有者/管理员可编辑；私有页仅所有者/管理员可见”的权限规则，并新增对应 API 合约测试。
- 版本历史已接入 workspace pages；同时修正版本任务读取不存在的 `Page.description` 属性、改为快照 `description_json`。
- “恢复版本”按钮现会调用后端恢复 API，而不只是更新编辑器内容；项目页恢复 URL 也已对齐后端版本详情路由。
- Workspace Pages 的访问权限由活动工作区成员关系继承；公开页成员可读，私有页仅所有者/管理员可读，编辑同样限所有者/管理员。
- 已实现将 Workspace Page 移入同一工作区项目；移动后页面从工作区列表移除，附件同步切换到项目访问域。移动者与原页面所有者都必须是目标项目成员。
- collection 和嵌套页面尚未实现；项目页跨项目移动仍需另行恢复。
- 对应权限、版本读写与快照测试已补充，待运行验证。

代码线索：

- `packages/i18n/src/locales/en/wiki.json`
- `packages/i18n/src/locales/en/workspace.json`
- `apps/api/plane/utils/permissions/page.py`

TODO：

- [x] 盘点 Workspace Wiki 相关路由、菜单和数据来源
- [ ] 检查 collection、shared/private/public page 的后端接口是否齐全；shared/private 已有基础 API，collection 尚未实现
- [ ] 去掉 wiki 相关付费限制提示
- [x] 恢复 workspace-level pages 入口与创建流程
- [x] 补齐并核对 workspace page 的成员权限继承规则
- [x] 接通 workspace page 版本列表、详情和恢复；修复快照 JSON 字段，并让版本历史 UI 调用恢复 API
- [x] 实现 workspace page 移入同一 workspace 下项目的 API、权限检查、附件作用域更新和前端入口
- [ ] 运行 API 合约测试并验证页面移动、版本历史端到端链路

难度：中

#### 3. Custom Work Item Types / Properties

状态判断：

- 仓库已有 `IssueType`、`ProjectIssueType`、工作项 `type` 外键及相关数据库迁移，基础模型并非空白。
- 已补齐工作区类型管理和项目类型绑定的内部/外部 API、项目设置页、启用开关和工作项类型选择器。
- 创建工作项时会继承项目默认类型；创建和更新均会校验类型属于当前项目。
- `ProjectUserProperty` / `IssueUserProperty` 仍只是用户显示、筛选和排序偏好，不是自定义业务字段模型。
- 自定义字段定义、字段值存储及表单动态渲染仍未实现。

代码线索：

- `packages/i18n/src/locales/en/work-item-type.json`
- `packages/constants/src/fetch-keys.ts`

TODO：

- [x] 盘点 Work Item Type 设置页、数据模型和接口
- [x] 补齐工作区工作项类型 CRUD API
- [x] 补齐项目类型关联 API 和默认类型维护
- [x] 校验工作项类型只能关联同一 Workspace 的项目
- [x] 开发项目级工作项类型配置页面和启用开关
- [x] 在工作项创建弹窗和详情页接入类型选择
- [ ] 检查自定义属性是否已可增删改查；当前无字段定义模型
- [ ] 校验 Work Item Type 与 Workflow 的绑定逻辑
- [ ] 评估是否需要同时恢复 hierarchy

难度：中

#### 4. Workflows

状态判断：

- 前端工作流配置文案和交互文案非常完整。
- 当前能确认的是“状态流转规则”能力，不等同于完整审批系统。
- 当前后端核心模型是项目级 `State`，提供状态名称、颜色、分组和顺序。
- 尚未发现“来源状态 -> 目标状态 -> 允许角色/条件”的持久化规则模型，当前不能宣称已支持可配置状态转换策略。

代码线索：

- `packages/i18n/src/locales/en/workflow.json`
- `packages/i18n/src/locales/zh-CN/project-settings.json`
- `packages/constants/src/fetch-keys.ts`

TODO：

- [ ] 盘点 workflow 列表页、详情页、规则编辑页是否已存在
- [ ] 确认后端是否已有 state change rule 持久化模型
- [ ] 恢复 workflow 开关与设置入口
- [ ] 验证“谁能从 A 状态移动到 B 状态”的规则是否真正生效
- [ ] 区分“工作流规则”与“审批流”范围，避免误判

难度：中

#### 5. Time Tracking

状态判断：

- 项目模型已有 `is_time_tracking_enabled`。
- 仓库包含 TIME 类型的工作项估算，但未发现工时记录模型、worklog API、工时录入 UI 或 timesheet 查询实现。
- 当前项目开关字段没有形成可用的工时记录端到端链路；历史 timesheet 不能通过恢复入口直接获得。

代码线索：

- `apps/api/plane/db/models/project.py`
- `packages/i18n/src/locales/en/project-settings.json`

TODO：

- [x] 确认记录工时、汇总工时、导出 timesheets 的接口是否存在；当前均未发现实现
- [ ] 恢复项目设置中的 time tracking 开关
- [ ] 盘点 work item 详情中的工时录入 UI
- [ ] 验证跨项目 timesheet 统计是否可用
- [ ] 明确内部版是否需要“历史工时报表”；若需要，需设计工时记录模型和查询/导出 API

难度：中低

#### 6. Intake + 基础 Automations

状态判断：

- Intake 后端接口和页面路由是真实存在的。
- Automations 当前更像基础版，已确认有 auto-archive / auto-close。

代码线索：

- `apps/api/plane/api/views/intake.py`
- `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/intake/page.tsx`
- `apps/web/core/components/automation/auto-archive-automation.tsx`
- `apps/web/core/components/automation/auto-close-automation.tsx`

TODO：

- [ ] 验证 Intake 列表、创建、接受、拒绝、转正式工作项链路
- [x] 恢复 Intake 功能入口和项目特性开关；项目导航、项目设置及 `intake_view` 字段链路已存在
- [ ] 评估是否已有 triage state 自动创建逻辑
- [x] 恢复 auto-archive / auto-close 两项自动化配置；设置 UI 和项目字段已有实现，仍需运行时验证定时任务
- [ ] 暂不把基础 automations 等同于 Business 自定义自动化

难度：中

### B 级：有明显半成品，适合第二阶段评估

#### 7. Templates

状态判断：

- 文案和交互提示非常完整，覆盖 project / work item / page templates。
- 但尚未确认有完整的数据模型和端到端实现。

代码线索：

- `packages/i18n/src/locales/en/template.json`
- `apps/web/core/components/project/create-project-modal.tsx`
- `apps/web/core/components/issues/issue-modal/modal.tsx`

TODO：

- [ ] 搜索 template 相关后端 model / serializer / API
- [ ] 确认 `templateId` 只是预留参数还是已有调用链
- [ ] 判断 project / page / work item template 三类是否需分步恢复
- [ ] 若后端缺失，则设计最小可用模板体系

难度：中高

#### 8. Recurring Work Items

状态判断：

- 文案和空状态很完整。
- 目前没有看到对应的模型和 API 主体。

代码线索：

- `packages/i18n/src/locales/zh-CN/work-item.json`

TODO：

- [ ] 搜索 recurring work item 相关模型、任务调度、接口
- [ ] 确认是否仅有文案占位
- [ ] 若需自研，先定义最小功能：周期、开始时间、生成规则、关闭策略
- [ ] 评估是否依赖模板系统

难度：中高

#### 9. Teamspaces / Initiatives

状态判断：

- store、router、文案中有 teamspace / initiative 信号。
- 但当前未确认是否已有完整页面和数据模型。

代码线索：

- `apps/web/core/store/router.store.ts`
- `apps/web/core/store/theme.store.ts`
- `apps/api/plane/utils/constants.py`

TODO：

- [ ] 盘点 teamspace / initiative 相关页面、路由、接口
- [ ] 判断是“残留概念支持”还是“已有完整模块”
- [ ] 若仅部分存在，先决定内部版是否真的需要

难度：中高

### C 级：高难度，不建议前期投入

#### 10. Customers

状态判断：

- 当前主要看到 `customer_count`、`customer_request_count` 等展示字段信号。
- 未看到完整 customer 管理模块主体。

TODO：

- [ ] 确认 customer 实体、request 实体、关联 work item 的模型是否存在
- [ ] 若缺失，按“客户档案 + 客户诉求 + 工作项关联”重新设计

难度：高

#### 11. Approvals / 正式审批流

状态判断：

- Marketing 文案提到 approvals。
- 当前仓库里更像 workflow reviewers，而不是正式审批系统。

TODO：

- [ ] 明确审批流是否有独立模型、记录、状态和权限
- [ ] 如果没有，不要把 workflow 当成审批流直接上线
- [ ] 评估内部实际是否需要签核机制

难度：高

#### 12. SSO / SAML / LDAP

状态判断：

- 文案存在，但企业扩展类型文件为 `never`，未见实际实现。

代码线索：

- `packages/types/src/instance/auth-ee.ts`
- `packages/i18n/src/locales/zh-CN/auth.json`

TODO：

- [ ] 不作为当前阶段目标
- [ ] 若后续必须接企业身份源，单独立项

难度：很高

#### 13. RBAC / GAC / Enterprise Grid

状态判断：

- 当前主要是对比表和营销分层，不像仓库内已有成熟实现。

TODO：

- [ ] 不作为当前阶段目标
- [ ] 若后续必须细粒度权限控制，需单独设计权限模型

难度：很高

## 推荐实施顺序

### 第一阶段：优先拿结果

- [ ] Dashboards
- [ ] Workspace Wiki / Workspace Pages
- [ ] Custom Work Item Types / Properties
- [ ] Workflows
- [ ] Time Tracking
- [ ] Intake + 基础 Automations

### 第二阶段：补增强能力

- [ ] Templates
- [ ] Recurring Work Items
- [ ] Teamspaces / Initiatives

### 第三阶段：谨慎评估是否立项

- [ ] Customers
- [ ] Approvals
- [ ] SSO / SAML / LDAP
- [ ] RBAC / GAC

## 建议的执行方式

### 路线建议

优先采用下面的策略，而不是尝试完整复刻官方商业版：

1. 先恢复已有主体实现但被隐藏或受限的模块
2. 再补半成品模块
3. 最后再评估是否需要自研企业级治理能力

### 每个模块的标准排查步骤

- [ ] 查模型：`apps/api/plane/db/models`
- [ ] 查迁移：`apps/api/plane/db/migrations`
- [ ] 查接口：`apps/api/plane/api/views`、`serializers`、`urls`
- [ ] 查前端路由：`apps/web/app`
- [ ] 查 store / service：`apps/web/core/store`、`packages/services`
- [ ] 查 plan gate：升级弹窗、comparison、feature flag、权限判断
- [ ] 查文案：`packages/i18n`

## 当前建议

如果目标是尽快让内部版具备更强的研发管理能力，建议下一步直接启动以下专项排查：

- [ ] `Dashboards` 可恢复点清单
- [ ] `Workspace Wiki` 可恢复点清单
- [ ] `Work Item Types / Properties` 可恢复点清单
- [ ] `Workflows` 实现深度核查
- [ ] `Time Tracking` 端到端核查
- [ ] `Intake / Automations` 端到端核查

完成以上 6 项后，再决定是否继续进入 Templates、Recurring、Customers 等第二梯队模块。
