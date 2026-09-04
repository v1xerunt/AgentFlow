// Surface Node check failures in the Actions annotations as well as the job log.
// Monitoring leaves Node's normal error reporting and nonzero exit intact.
if (process.env.GITHUB_ACTIONS === 'true') {
  process.on('uncaughtExceptionMonitor', error => {
    const message = String(error.stack || error).slice(-12_000)
      .replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
    console.error(`::error::${message}`)
  })
}
