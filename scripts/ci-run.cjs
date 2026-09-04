const spawn = process.platform === 'win32' ? require('cross-spawn') : require('node:child_process').spawn
const [command, ...args] = process.argv.slice(2)
if (!command) throw new Error('Usage: node scripts/ci-run.cjs <command> [args...]')
let tail = ''
const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true })
for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.on('data', chunk => {
    output.write(chunk)
    tail = (tail + chunk.toString()).slice(-12_000)
  })
}
child.on('error', error => { tail += error.stack; console.error(error) })
child.on('close', code => {
  process.exitCode = code ?? 1
  if (process.exitCode && process.env.GITHUB_ACTIONS === 'true') {
    const message = tail.replace(/\u001b\[[0-9;]*m/g, '')
      .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    console.error(`::error::${message}`)
  }
})
