import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('localizes visible JSX text, accessible labels, and every interpolated message', () => {
  const errors: string[] = []
  const roots = [resolve('src'), resolve('../../packages/core/src')]
  for (const root of roots) for (const file of readdirSync(root, { recursive: true }).map(String).filter(f => /\.tsx?$/.test(f) && !/\.test\.|localization[\\/](messages|index)\.ts/.test(f))) {
    const path = resolve(root, file)
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    const report = (node: ts.Node, message: string) => errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${message}`)
    const visit = (node: ts.Node) => {
      if (ts.isJsxText(node)) {
        const value = node.text.trim()
        if (/[A-Za-z\p{Script=Han}]/u.test(value) && !/^(AgentFlow|Agent|Flow|中文|English|Ctrl\+[CVZ]|v|· v|B ·)$/.test(value)) report(node, `Untranslated text: ${value}`)
      }
      if (ts.isJsxAttribute(node) && /^(aria-label|ariaLabel|title|placeholder|alt)$/.test(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer) && /[A-Za-z\p{Script=Han}]/u.test(node.initializer.text) && !['AgentFlow', 'wrkspc_…'].includes(node.initializer.text)) report(node, `Untranslated attribute: ${node.initializer.text}`)
      if (ts.isTemplateExpression(node) && /\.tsx$/.test(file)) {
        const text = [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(' ')
        if (/\b(nodes|links|Artifact|Input|Output|Provider|Prompt|Result|Fork)\b/.test(text)) report(node, `Untranslated template: ${text}`)
      }
      if (ts.isCallExpression(node) && node.expression.getText() === 't' && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const indices = [...node.arguments[0].text.matchAll(/\{(\d+)\}/g)].map(match => Number(match[1]))
        const values = node.arguments[1]
        if (indices.length && (!values || (ts.isArrayLiteralExpression(values) && values.elements.length <= Math.max(...indices)))) report(node, 'Missing interpolation values')
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  expect(errors).toEqual([])
})
