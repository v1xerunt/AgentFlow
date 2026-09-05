param([string]$Node, [string]$Revision)
$ErrorActionPreference = 'Stop'
$skillDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function Test-CompatibleNode([string]$Candidate) {
  if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) { return $false }
  try {
    $versionOutput = & $Candidate --version 2>$null
    if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch '^v(\d+)\.(\d+)\.\d+$') { return $false }
    return [int]$Matches[1] -gt 22 -or ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 13)
  } catch { return $false }
}
if ($Node) {
  if (-not (Test-CompatibleNode $Node)) { throw 'The supplied Node executable must be Node.js 22.13+.' }
} else {
  $configPath = Join-Path $skillDirectory '.agentflow/config.json'
  if (Test-Path -LiteralPath $configPath) { $Node = (Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json).node }
  if (-not (Test-CompatibleNode $Node)) { $Node = (Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source }
}
if (-not (Test-CompatibleNode $Node)) {
  $architecture = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  if ($architecture -notin @('x64', 'arm64')) { throw "Unsupported Windows architecture: $architecture" }
  $checksums = (Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/download/release/latest-v24.x/SHASUMS256.txt' -TimeoutSec 20).Content
  $entry = [regex]::Matches($checksums, "(?m)^([a-f0-9]{64})\s+(node-(v24\.\d+\.\d+)-win-$architecture\.zip)\s*$")
  if ($entry.Count -ne 1) { throw 'Could not resolve the official Node LTS archive.' }
  $expectedHash = $entry[0].Groups[1].Value
  $archiveName = $entry[0].Groups[2].Value
  $version = $entry[0].Groups[3].Value
  $cacheBase = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) '.local/share' }
  $runtimeDirectory = [IO.Path]::GetFullPath((Join-Path $cacheBase 'AgentFlow/runtimes/node'))
  $destination = Join-Path $runtimeDirectory "$version-win-$architecture"
  $Node = Join-Path $destination 'node.exe'
  if (-not (Test-CompatibleNode $Node)) {
    if (Test-Path -LiteralPath $destination) { throw "The runtime directory already exists but is unusable: $destination" }
    $temporary = Join-Path $runtimeDirectory ('.download-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary -Force | Out-Null
    try {
      Write-Host "Preparing a private Node runtime: $version ($architecture)"
      $archive = Join-Path $temporary $archiveName
      Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/download/release/$version/$archiveName" -OutFile $archive -TimeoutSec 120
      $stream = [IO.File]::OpenRead($archive)
      $hasher = [Security.Cryptography.SHA256]::Create()
      try { $actualHash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
      finally { $stream.Dispose(); $hasher.Dispose() }
      if ($actualHash -ne $expectedHash) { throw 'Node archive checksum mismatch.' }
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      [IO.Compression.ZipFile]::ExtractToDirectory($archive, $temporary)
      $extracted = [IO.Path]::GetFullPath((Join-Path $temporary "node-$version-win-$architecture"))
      if (-not $extracted.StartsWith($temporary + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid runtime extraction path.' }
      if (-not (Test-CompatibleNode (Join-Path $extracted 'node.exe'))) { throw 'Downloaded Node could not run on this computer.' }
      [IO.Directory]::Move($extracted, $destination)
    } finally {
      $resolvedTemporary = [IO.Path]::GetFullPath($temporary)
      if ($resolvedTemporary.StartsWith($runtimeDirectory + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedTemporary -Leaf).StartsWith('.download-')) {
        Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
      }
    }
  }
}
$arguments = @((Join-Path $PSScriptRoot 'agentflow.mjs'), 'skill', 'setup')
if ($Revision) { $arguments += @('--revision', $Revision) }
& $Node @arguments
if ($LASTEXITCODE -ne 0) { throw 'Skill setup failed.' }
& $Node (Join-Path $PSScriptRoot 'agentflow.mjs') host validate (Join-Path $skillDirectory 'assets/review-flow.json')
if ($LASTEXITCODE -ne 0) { throw 'Skill verification failed.' }
