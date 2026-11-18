import { defineConfig } from 'vitepress';

/**
 * data-docs：三套风控数据 SDK 的统一 API 文档站。
 *   reference/<slug>/  面向读者的 API / 指南（从归档 docs 仓同步，本站手写区）
 *   projects/<slug>/   主仓 CI 推送的脱敏快照（只读镜像）
 *   guide/             三项目共用约定
 * 外观对标 fuyao.aicubes.cn/docs/api-reference/overview/：
 * 深色主题 + 红色强调 + 顶部导航 + 左侧产品树 + 右侧本页目录 + 反馈入口。
 */
const docsRepoUrl = process.env.DOCS_REPO_URL?.trim().replace(/\/+$/, '') || '';
const docsEditLink = process.env.DOCS_EDIT_LINK?.trim().replace(/\/+$/, '') || '';
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });

export default defineConfig({
  lang: 'zh-CN',
  title: '风控数据 API',
  titleTemplate: ':title · 企业风控数据产品族',
  description: 'xyj-api / altdatahub / elecredit 统一接入文档：REST 契约、多语言 SDK、能力服务与 AI 接入',
  cleanUrls: false,
  ignoreDeadLinks: true,
  lastUpdated: true,
  appearance: 'dark',
  srcExclude: ['README.md', 'projects/**/manifest.json'],
  head: [
    ['meta', { name: 'theme-color', content: '#ff5b70' }],
    ['meta', { name: 'description', content: '企业风控数据产品族统一 API 文档：REST 契约、多语言 SDK、能力服务与 MCP 接入' }],
  ],
  markdown: { lineNumbers: true },
  vite: {
    // CNB 端口转发域名（*.cnb.run）默认不在 Vite 的 host 白名单里，需显式放行
    server: { allowedHosts: ['.cnb.run'] },
  },
  themeConfig: {
    nav: [
      { text: '文档', link: '/', activeMatch: '/guide/' },
      { text: '产品 API', items: [
        { text: 'elecredit · 企业风控', link: '/reference/elecredit/api/index' },
        { text: 'altdatahub · 替代数据通', link: '/reference/altdatahub/api/index' },
        { text: 'xyj-api · 上下游发票', link: '/projects/xyj-api/README' },
      ] },
      { text: '接入指南', items: [
        { text: '共用架构', link: '/guide/architecture' },
        { text: '发版约定', link: '/guide/release-conventions' },
        { text: '多语言 SDK 矩阵', link: '/guide/sdk-matrix' },
      ] },
      { text: '最佳实践', link: '/reference/elecredit/guide/faq' },
    ],
    sidebar: [
      { text: '平台概览', collapsed: false, items: [
        { text: '首页', link: '/' },
        { text: '契约驱动架构', link: '/guide/architecture' },
        { text: '发版约定', link: '/guide/release-conventions' },
        { text: '多语言 SDK 矩阵', link: '/guide/sdk-matrix' },
      ] },
      { text: 'elecredit · 企业风控', collapsed: false, items: [
        { text: '项目介绍', link: '/reference/elecredit/guide/overview' },
        { text: '快速开始', link: '/reference/elecredit/guide/quick-start' },
        { text: 'REST API', collapsed: false, items: [
          { text: '接口总览', link: '/reference/elecredit/api/index' },
          { text: '工商域（A 系列）', items: [
            { text: 'A07 企业模糊查询', link: '/reference/elecredit/api/fuzzy' },
            { text: 'A03 工商深度查询', link: '/reference/elecredit/api/deep' },
            { text: 'A04 大中小微划型', link: '/reference/elecredit/api/scale' },
          ] },
          { text: '税务域（B 系列）', items: [{ text: 'B06 税务信用', link: '/reference/elecredit/api/tax' }] },
          { text: '招投标域（B 系列）', items: [{ text: 'B04 招投标信息', link: '/reference/elecredit/api/bidding' }] },
          { text: '风险域（D 系列）', items: [
            { text: 'D07 行政处罚', link: '/reference/elecredit/api/admin-punishment' },
            { text: 'D11 司法查询', link: '/reference/elecredit/api/judicial' },
          ] },
          { text: '诉讼域（D 系列）', items: [{ text: 'D14 限制高消费人员', link: '/reference/elecredit/api/xgbzxr' }] },
          { text: '图谱与实控人', items: [
            { text: 'F09 企业股权图谱', link: '/reference/elecredit/api/graph' },
            { text: 'P0020019 实控人', link: '/reference/elecredit/api/actual-controller' },
          ] },
        ] },
        { text: '接入指南', collapsed: true, items: [
          { text: '凭据配置', link: '/reference/elecredit/guide/authentication' },
          { text: '签名算法', link: '/reference/elecredit/guide/signature' },
          { text: 'Node.js CLI', link: '/reference/elecredit/guide/node-cli' },
          { text: 'Python SDK', link: '/reference/elecredit/guide/python-sdk' },
          { text: 'Agent Skill', link: '/reference/elecredit/guide/agent-skill' },
          { text: '错误码', link: '/reference/elecredit/guide/errors' },
          { text: '常见问题', link: '/reference/elecredit/guide/faq' },
        ] },
        { text: '原始快照 README', link: '/projects/elecredit/README' },
      ] },
      { text: 'altdatahub · 替代数据通', collapsed: false, items: [
        { text: '产品首页', link: '/reference/altdatahub/index' },
        { text: 'API 文档', collapsed: false, items: [
          { text: '总览与鉴权', link: '/reference/altdatahub/api/index' },
          { text: '端点参考', link: '/reference/altdatahub/api/endpoints' },
          { text: '数据契约', link: '/reference/altdatahub/contract/index' },
          { text: '能力矩阵', link: '/reference/altdatahub/contract/capabilities' },
          { text: '原始文档镜像', link: '/reference/altdatahub/reference/index' },
        ] },
        { text: 'MCP 文档', collapsed: false, items: [
          { text: '总览', link: '/reference/altdatahub/mcp/index' },
          { text: 'Tools 参考', link: '/reference/altdatahub/mcp/tools' },
          { text: '部署与配置', link: '/reference/altdatahub/mcp/deploy' },
        ] },
        { text: '开发工具', collapsed: true, items: [
          { text: '安装与 CLI', link: '/reference/altdatahub/getting-started/install' },
          { text: 'Python SDK', link: '/reference/altdatahub/guides/python' },
          { text: '多语言 SDK', link: '/reference/altdatahub/guides/sdks' },
          { text: '能力服务部署', link: '/reference/altdatahub/guides/service' },
          { text: '工具链与生成器', link: '/reference/altdatahub/guides/toolchain' },
          { text: '契约治理', link: '/reference/altdatahub/guides/contract-governance' },
          { text: '排障 FAQ', link: '/reference/altdatahub/guides/troubleshooting' },
        ] },
        { text: '变更记录', link: '/projects/altdatahub/CHANGELOG' },
      ] },
      { text: 'xyj-api · 上下游发票', collapsed: true, items: [
        { text: '项目介绍', link: '/projects/xyj-api/README' },
        { text: '协议约定', link: '/projects/xyj-api/docs/protocol' },
        { text: '集成指南', link: '/projects/xyj-api/docs/INTEGRATION' },
        { text: '共用架构', link: '/projects/xyj-api/docs/architecture' },
        { text: '能力服务', link: '/projects/xyj-api/service/README' },
        { text: 'MCP 接入', link: '/projects/xyj-api/mcp/README' },
      ] },
    ],
    search: { provider: 'local', options: { miniSearch: {
      options: {
        tokenize: (text: string) => [...segmenter.segment(text)].filter((s) => s.isWordLike).map((s) => s.segment),
        processTerm: (term: string) => term.toLowerCase(),
      },
      searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } },
    } } },
    outline: { level: [2, 3], label: '本页总览' },
    lastUpdated: { text: '最后更新', formatOptions: { dateStyle: 'short' } },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    externalLinkIcon: true,
    editLink: docsEditLink ? { pattern: `${docsEditLink}/:path`, text: '在源仓编辑' } : undefined,
    socialLinks: docsRepoUrl ? [{ icon: 'github', link: docsRepoUrl }] : [],
    footer: { message: '内容事实源在各主仓 docs/；本站含归档文档仓同步内容与脱敏快照镜像', copyright: '© 2026 h1s97x' },
  },
});
