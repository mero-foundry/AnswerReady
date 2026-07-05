import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { context } from 'esbuild'

const watchMode = process.argv.includes('--watch')
const root = process.cwd()
const distDir = path.join(root, 'dist')
const assetsDir = path.join(distDir, 'assets')
const publicDir = path.join(root, 'public')

async function writeIndex() {
  await mkdir(distDir, { recursive: true })
  await writeFile(
    path.join(distDir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AnswerReady</title>
    <script type="module" crossorigin src="/assets/app.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/app.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
  )
}

async function copyPublic() {
  await cp(publicDir, distDir, { recursive: true, force: true })
}

async function prepareDist() {
  await rm(distDir, { recursive: true, force: true })
  await mkdir(assetsDir, { recursive: true })
  await copyPublic()
  await writeIndex()
}

const buildOptions = {
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  outdir: assetsDir,
  entryNames: 'app',
  assetNames: '[name]-[hash]',
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: watchMode,
  minify: !watchMode,
  loader: {
    '.png': 'file',
    '.svg': 'file',
  },
  logLevel: 'info',
}

await prepareDist()

if (watchMode) {
  const buildContext = await context(buildOptions)
  await buildContext.watch()
  console.log('AnswerReady client build watching src/')
} else {
  const buildContext = await context(buildOptions)
  await buildContext.rebuild()
  await buildContext.dispose()
}
