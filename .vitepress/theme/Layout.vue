<script setup>
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #doc-after>
      <a
        class="feedback-float"
        href="https://github.com/h1s97x/data-docs/issues"
        target="_blank"
        rel="noopener noreferrer"
        title="反馈交流渠道"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-4H6V8h12v2zm0-4H6V4h12v2z" />
        </svg>
        反馈交流渠道
      </a>
    </template>
  </Layout>
</template>
