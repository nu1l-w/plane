# 修改产品名称

品牌名称的唯一编辑入口是 `packages/constants/src/branding.ts` 的 `BRAND_NAME`，当前为「联序 & 星轴」。

修改后运行 `pnpm branding:sync`，同步邮件和 AI 使用的 Python 品牌配置，以及 web/admin/space 的静态应用清单；提交生成文件，重新构建前端并重启 API 和 worker。

页面、标题及各语言翻译会使用统一品牌配置。翻译键、包名、数据库标识、API 路径、第三方服务链接、上游版权声明保持原样。新页面请从 `@plane/constants` 导入 `BRAND_NAME`；邮件模板使用 `{% load branding %}` 和 `{% brand_name %}`；Python 使用 `plane.utils.branding.BRAND_NAME`。
