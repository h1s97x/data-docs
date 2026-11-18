import { defineConfig } from 'vitepress';
import { projects } from './nav.generated.mjs';

/**
 * data-docs：xyj-api / altdatahub / elecredit 共用文档站。
 *
 * 事实源在各主仓 docs/；本站 projects/<slug>/ 是 CI 推送的脱敏快照（只读镜像）。
 * 共用内容（架构模式、发版约定、语言矩阵）在 guide/，本站唯一手写区。
 *
 * cleanUrls 默认关闭：GitHub Pages 不对无扩展名 URL 做重写，开 cleanUrls 会 404。
 */
const docsRepoUrl = process.env.DOCS_REPO_URL?.trim().replace(/\/+$/, '') || '';
const docsEditLink = process.env.DOCS_EDIT_LINK?.trim().replace(/\/+$/, '') || '';

const projectNav = projects.map((p) => ({ text: p.label, link: `/projects/${p.id}/README`, activeMatch: `/projects/${p.id}/` }));

export default defineConfig({
  lang: 'zh-CN',
  title: 'Data Docs',
  titleTemplate: ':title · 企业风控数据产品族',
  description: 'xyj-api / altdatahub / elecredit 的统一接入文档：多语言 SDK、REST 契约、能力服务与 AI 接入',
  cleanUrls: false,
  lastUpdated: true,
  srcExclude: ['README.md', 'projects/**/manifest.json'],
  head: [['meta', { name: 'theme-color', content: '#0b66ff' }]],
  markdown: { lineNumbers: true },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '共用指南', link: '/guide/architecture', activeMatch: '/guide/' },
      ...projectNav,
    ],
    sidebar: {
      '/guide/': [
        {
          text: '共用约定',
          items: [
            { text: '契约驱动架构', link: '/guide/architecture' },
            { text: '发版约定', link: '/guide/release-conventions' },
            { text: '多语言 SDK 矩阵', link: '/guide/sdk-matrix' },
          ],
        },
      ],
      '/projects/xyj-api/': [{ text: 'xyj-api（镜像）', items: [{ text: '项目 README', link: '/projects/xyj-api/README' }] }],
      '/projects/altdatahub/': [{ text: 'altdatahub（镜像）', items: [{ text: '项目 README', link: '/projects/altdatahub/README' }] }],
      '/projects/elecredit/': [{ text: 'elecredit（镜像）', items: [{ text: '项目 README', link: '/projects/elecredit/README' }] }],
    },
    search: { provider: 'local' },
    editLink: docsEditLink ? { pattern: `${docsEditLink}/:path`, text: '在源仓编辑' } : undefined,
    socialLinks: docsRepoUrl ? [{ icon: 'github', link: docsRepoUrl }] : [],
    footer: { message: '内容事实源在各主仓 docs/；本站为脱敏快照镜像', copyright: '© 2026 h1s97x' },
  },
});
