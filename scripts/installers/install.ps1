param([switch]$NoStart)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$sourceDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$installDir = if ($env:HOLIDAY_INSTALL_DIR) { [IO.Path]::GetFullPath($env:HOLIDAY_INSTALL_DIR) } else { Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'HolidayArcade' }
$env:HOLIDAY_INSTALL_DIR = $installDir

function Test-Node([string]$Executable) {
    if (-not $Executable -or -not (Test-Path -LiteralPath $Executable)) { return $false }
    try {
        & $Executable -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)' 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

try {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    $nodePath = if ($nodeCommand -and (Test-Node $nodeCommand.Source)) { $nodeCommand.Source } else { Join-Path $installDir 'runtime\node.exe' }
    if (-not (Test-Node $nodePath)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        $marker = Join-Path $installDir '.holiday-arcade-install'
        if (Test-Path -LiteralPath $marker) {
            if (([IO.File]::ReadAllText($marker)).TrimEnd("`r", "`n") -ne 'Holiday Arcade installer v1') { throw 'Unknown installation folder owner. Choose an empty HOLIDAY_INSTALL_DIR.' }
        } elseif (@(Get-ChildItem -LiteralPath $installDir -Force).Count -ne 0) {
            throw 'The installation folder is not empty. Choose an empty HOLIDAY_INSTALL_DIR.'
        } else {
            [IO.File]::WriteAllText($marker, "Holiday Arcade installer v1`n", (New-Object Text.UTF8Encoding($false)))
        }
        $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
        $architecture = switch ($architecture.ToUpperInvariant()) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { throw 'Automatic Node installation supports Windows x64 and ARM64.' } }
        Write-Host 'Downloading a private Node.js 24 LTS runtime from nodejs.org. No administrator access needed.'
        $scratchDir = Join-Path ([IO.Path]::GetTempPath()) ('holiday-arcade-node-' + [Guid]::NewGuid())
        New-Item -ItemType Directory -Path $scratchDir | Out-Null
        try {
            $checksums = (Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt').Content
            $match = [regex]::Match($checksums, "(?m)^([a-f0-9]{64})\s+(node-(v24\.\d+\.\d+)-win-$architecture\.zip)\s*$")
            if (-not $match.Success) { throw 'No matching Node.js runtime was found. Try again or install Node.js manually.' }
            $archive = Join-Path $scratchDir 'node.zip'
            Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$($match.Groups[3].Value)/$($match.Groups[2].Value)" -OutFile $archive
            if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $match.Groups[1].Value) { throw 'Node.js checksum verification failed. Nothing was activated.' }
            Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $scratchDir 'unpacked')
            $runtime = Join-Path (Join-Path $scratchDir 'unpacked') ([IO.Path]::GetFileNameWithoutExtension($match.Groups[2].Value))
            if (-not (Test-Node (Join-Path $runtime 'node.exe'))) { throw 'The downloaded Node.js runtime cannot run on this computer.' }
            $targetRuntime = Join-Path $installDir 'runtime'
            if (Test-Path -LiteralPath $targetRuntime) { throw 'The existing private runtime needs repair. Move its runtime folder aside and try again.' }
            Move-Item -LiteralPath $runtime -Destination $targetRuntime
            $nodePath = Join-Path $targetRuntime 'node.exe'
        } finally {
            Remove-Item -LiteralPath $scratchDir -Recurse -Force
        }
    }
    & $nodePath (Join-Path $sourceDir 'scripts\install.js')
    if ($LASTEXITCODE -ne 0) { throw 'Installation did not finish. See the message above.' }
    # Current process PATH is refreshed too; new terminals read the saved user PATH.
    $env:PATH = (Join-Path $installDir 'bin') + ';' + $env:PATH
    if (-not $NoStart) { & $nodePath (Join-Path $installDir 'app\scripts\run-installed.js') $installDir; exit $LASTEXITCODE }
} catch {
    Write-Host ('Installation stopped: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
