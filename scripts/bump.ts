import { readFile, writeFile } from 'node:fs/promises'

const sharedPkg = JSON.parse(await readFile('packages/shared/package.json', 'utf8'))
const semverRange = `^${sharedPkg.version}`

async function updateDependency(path: string) {
  const pkg = JSON.parse(await readFile(path, 'utf8'))
  if (pkg.dependencies?.['@rttnd/llm-shared'])
    pkg.dependencies['@rttnd/llm-shared'] = semverRange
  await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

await updateDependency('packages/client/package.json')
await updateDependency('packages/server/package.json')
