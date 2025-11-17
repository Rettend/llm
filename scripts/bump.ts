import { readFile, writeFile } from 'node:fs/promises'

const sharedPkg = JSON.parse(await readFile('packages/shared/package.json', 'utf8'))
const rootPkgPath = 'package.json'
const rootPkg = JSON.parse(await readFile(rootPkgPath, 'utf8'))

const version = `^${sharedPkg.version}`
if (!rootPkg.workspaces?.catalogs?.prod)
  throw new Error('Missing prod catalog')

rootPkg.workspaces.catalogs.prod['@rttnd/llm-shared'] = version
await writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)
