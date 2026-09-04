import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownContent } from './DocumentSurface'

describe('Markdown document rendering', () => {
  it('renders headings, tables, code and lists', () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { content: '# 标题\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst a = 1\n```\n\n- item' }))
    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<table>')
    expect(html).toContain('language-js')
    expect(html).toContain('<li>item</li>')
  })
  it('does not execute raw HTML or load remote images from generated text', () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { content: '<script>alert(1)</script>\n\n![image](https://example.com/tracker.png)\n\n[link](javascript:alert)' }))
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
  })
})
