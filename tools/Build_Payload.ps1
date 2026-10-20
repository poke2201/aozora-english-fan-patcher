# Run from the repository root in PowerShell: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\Build_Payload.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
if (-not (Test-Path '.\package-lock.json')) { throw 'Missing package-lock.json. Run npm.cmd install, then commit the lockfile.' }
if (-not (Test-Path '.\src\patcher.cjs') -or -not (Test-Path '.\manifests\aozora_patch_manifest.json')) { throw 'Missing source or manifest.' }
# Build dependencies locally; players do not run npm.
& npm.cmd ci --omit=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
$stage = Join-Path $env:TEMP ('AozoraPayload-' + [guid]::NewGuid().ToString('N'))
$destination = Join-Path $root 'downloads\Aozora-Patcher-Payload.zip'
try {
    New-Item -ItemType Directory -Force -Path $stage, (Join-Path $stage 'src'), (Join-Path $stage 'manifests'), (Join-Path $root 'downloads') | Out-Null
    Copy-Item '.\src\patcher.cjs', '.\src\build_aozora_patch_v2.cjs' -Destination (Join-Path $stage 'src')
    Copy-Item '.\manifests\aozora_patch_manifest.json' -Destination (Join-Path $stage 'manifests')
    Copy-Item '.\node_modules' -Destination $stage -Recurse
    if (Test-Path $destination) { Remove-Item $destination -Force }
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $destination -CompressionLevel Optimal
    Write-Host "Created $destination"
    Get-Item $destination | Select-Object FullName,Length
    Get-FileHash $destination -Algorithm SHA256 | Format-List
} finally {
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
}
