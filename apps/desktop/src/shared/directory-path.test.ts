import { expect, it } from 'vitest'
import { directoryPathIdentity, normalizeDirectoryPath } from './directory-path'
import { fileSegment } from './flow-project'

it('preserves filesystem roots, spaces and case-sensitive Unix directory identities', () => {
  expect(normalizeDirectoryPath('/')).toBe('/')
  expect(normalizeDirectoryPath('C:\\')).toBe('C:\\')
  expect(normalizeDirectoryPath('/data/folder ')).toBe('/data/folder ')
  expect(directoryPathIdentity('/data/Project')).not.toBe(directoryPathIdentity('/data/project'))
  expect(directoryPathIdentity('D:\\Work\\Demo')).toBe(directoryPathIdentity('d:/work/demo/'))
})

it('bounds encoded multilingual filenames and distinguishes long names', () => {
  expect(fileSegment('中文'.repeat(100)).length).toBeLessThan(100)
  expect(fileSegment('文'.repeat(100) + 'a')).not.toBe(fileSegment('文'.repeat(100) + 'b'))
  expect(fileSegment('abc')).toBe('id-abc')
})
