$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$securityFile = Join-Path $repoRoot "security.md"
if (!(Test-Path $securityFile)) { throw "security.md not found" }

# Findings to track (minimum set; we'll extend later)
$findings = @(
  @{
    Id = "C-01"
    Title = "C-01 - Service Role Key Exfiltration via Hardcoded Fallback URL"
    Patterns = @("frufbnurxhtrialetjdg.supabase.co")
  }
)

function Set-StatusLine {
  param(
    [string]$content,
    [string]$id,
    [string]$statusLine
  )

  # Find heading line that contains the ID (e.g., "### C-01 - ...")
  $lines = $content -split "`r?`n"
  $idx = -1
  for ($i=0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^\s*#+\s*$id(\b|\s|-)") { $idx = $i; break }
    if ($lines[$i] -match "^\s*#+\s*$id\s*-") { $idx = $i; break }
    if ($lines[$i] -match "^\s*#+\s*$id\b") { $idx = $i; break }
  }
  if ($idx -lt 0) { return $content } # if not found, do nothing

  # Insert or replace "Status:" line within next 12 lines or until next heading
  $insertAt = $idx + 1
  $statusIdx = -1
  for ($j=$idx+1; $j -lt [Math]::Min($lines.Length, $idx+13); $j++) {
    if ($lines[$j] -match "^\s*#+\s+") { break } # next heading
    if ($lines[$j] -match "^\s*Status\s*:") { $statusIdx = $j; break }
  }

  if ($statusIdx -ge 0) {
    $lines[$statusIdx] = $statusLine
  } else {
    $lines = $lines[0..($insertAt-1)] + @($statusLine) + $lines[$insertAt..($lines.Length-1)]
  }

  return ($lines -join "`r`n")
}

# Determine status by searching repo for patterns
$securityContent = Get-Content $securityFile -Raw
$today = Get-Date -Format "yyyy-MM-dd"

foreach ($f in $findings) {
  $found = $false
  foreach ($p in $f.Patterns) {
    $matches = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch "\\node_modules\\|\\test-results\\|\\\.git\\" } |
      Select-String -Pattern $p -SimpleMatch -ErrorAction SilentlyContinue

    if ($matches) { $found = $true; break }
  }

  if ($found) {
    $securityContent = Set-StatusLine -content $securityContent -id $f.Id -statusLine "Status: OPEN"
  } else {
    $securityContent = Set-StatusLine -content $securityContent -id $f.Id -statusLine "Status: FIXED ($today)"
  }
}

Set-Content -Path $securityFile -Value $securityContent -Encoding UTF8
Write-Host "security.md updated."
