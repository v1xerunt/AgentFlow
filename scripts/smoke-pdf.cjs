const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const { resolve } = require('node:path')
const pdfResolve = name => require.resolve(name, { paths: [resolve(__dirname, '../apps/desktop')] })

async function main() {
  const { getDocument } = await import(pathToFileURL(pdfResolve('pdfjs-dist/legacy/build/pdf.mjs')).href)
  const content = 'BT /F1 18 Tf 30 100 Td (AgentFlow PDF smoke) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const standardFontDataUrl = pdfResolve('pdfjs-dist/package.json').replace(/package\.json$/, 'standard_fonts/')
  const loadingTask = getDocument({ data: new Uint8Array(Buffer.from(pdf)), standardFontDataUrl })
  try {
    const document = await loadingTask.promise
    const text = await (await document.getPage(1)).getTextContent()
    assert.equal(text.items.map(item => item.str || '').join(''), 'AgentFlow PDF smoke')
    console.log('PDF parser and worker passed')
  } finally { await loadingTask.destroy() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
