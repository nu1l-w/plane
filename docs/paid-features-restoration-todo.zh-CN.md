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
- 仓库内已存在 dashboard service、store、组件和迁移痕迹。
- 更像是“已有主体实现 + plan gate / 入口限制”。

代码线索：
- `packages/services/src/dashboard/dashboard.service.ts`
- `apps/api/plane/db/migrations/0054_dashboard_widget_dashboardwidget.py`
- `apps/api/plane/db/migrations/0055_auto_20240108_0648.py`

TODO：
- [ ] 盘点 Dashboard 页面入口、菜单入口、权限开关
- [ ] 确认社区版是否仅隐藏入口，还是后端接口也有限制
- [ ] 恢复 Workspace/Home Dashboard 可见性
- [ ] 验证 widget 查询、过滤、统计接口是否完整
- [ ] 补充中文化与品牌替换

难度：中低

#### 2. Workspace Wiki / Workspace Pages

状态判断：
- Workspace pages、shared pages、private pages、wiki collections 等文案与结构都较完整。
- 后端权限代码里明确预留了 feature flag 覆盖点。

代码线索：
- `packages/i18n/src/locales/en/wiki.json`
- `packages/i18n/src/locales/en/workspace.json`
- `apps/api/plane/utils/permissions/page.py`

TODO：
- [ ] 盘点 Workspace Wiki 相关路由、菜单和数据来源
- [ ] 检查 collection、shared/private/public page 的后端接口是否齐全
- [ ] 去掉 wiki 相关付费限制提示
- [ ] 恢复 workspace-level pages 入口与创建流程
- [ ] 验证页面移动、权限继承、版本历史是否可用

难度：中

#### 3. Custom Work Item Types / Properties

状态判断：
- work item types、hierarchy、workflow 绑定等文案齐全。
- 很可能已有实体和前端骨架，只是被 plan 控制。

代码线索：
- `packages/i18n/src/locales/en/work-item-type.json`
- `packages/constants/src/fetch-keys.ts`

TODO：
- [ ] 盘点 Work Item Type 设置页、数据模型和接口
- [ ] 检查自定义属性是否已可增删改查
- [ ] 校验 Work Item Type 与 Workflow 的绑定逻辑
- [ ] 恢复项目级工作项类型入口
- [ ] 评估是否需要同时恢复 hierarchy

难度：中

#### 4. Workflows

状态判断：
- 前端工作流配置文案和交互文案非常完整。
- 当前能确认的是“状态流转规则”能力，不等同于完整审批系统。

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
- 文案和计划比较中也反复出现 time tracking / timesheets。

代码线索：
- `apps/api/plane/db/models/project.py`
- `packages/i18n/src/locales/en/project-settings.json`

TODO：
- [ ] 确认记录工时、汇总工时、导出 timesheets 的接口是否存在
- [ ] 恢复项目设置中的 time tracking 开关
- [ ] 盘点 work item 详情中的工时录入 UI
- [ ] 验证跨项目 timesheet 统计是否可用
- [ ] 明确内部版是否需要“历史工时报表”

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
- [ ] 恢复 Intake 功能入口和项目特性开关
- [ ] 评估是否已有 triage state 自动创建逻辑
- [ ] 恢复 auto-archive / auto-close 两项自动化配置
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
