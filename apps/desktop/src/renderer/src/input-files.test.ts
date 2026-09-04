import { describe, expect, it } from 'vitest'
import { canExtractAsText, classifyInputFile, extractFileText } from './input-files'

describe('input files', () => {
  it('classifies extractable text, supported images, and filtered files', () => {
    const pdf = new File(['pdf'], 'report.pdf', { type: 'application/pdf' })
    const image = new File(['image'], 'photo.webp', { type: 'image/webp' })
    const archive = new File(['zip'], 'bundle.zip', { type: 'application/zip' })
    expect(classifyInputFile(pdf)).toBe('text')
    expect(classifyInputFile(image)).toBe('image')
    expect(classifyInputFile(archive)).toBe('unsupported')
  })

  it('extracts plain text and strips HTML markup', async () => {
    const html = new File(['<h1>Title</h1><script>ignore()</script><p>Hello &amp; world</p>'], 'page.html', { type: 'text/html' })
    expect(canExtractAsText(html)).toBe(true)
    expect(await extractFileText(html)).toBe('Title Hello & world')
  })
})
