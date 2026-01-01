$ErrorActionPreference = "Stop"

$dir = Join-Path (Get-Location) "cover"
$out = Join-Path $dir "covers.json"

if (!(Test-Path $dir)) {
  Write-Host "[WARN] Folder 'cover' not found. Skipping."
  exit 0
}

# Supported extensions
$exts = @(".jpg", ".jpeg", ".png", ".webp", ".gif")

# Get all files, then filter by extension (reliable)
$files = Get-ChildItem -Path $dir -File |
  Where-Object { $exts -contains $_.Extension.ToLower() } |
  Sort-Object Name |
  Select-Object -ExpandProperty Name

if (-not $files -or $files.Count -eq 0) {
  Write-Host "[WARN] No images found in cover/. Writing empty array."
  $files = @()
}

# Write JSON
($files | ConvertTo-Json -Depth 1) | Out-File -FilePath $out -Encoding utf8

Write-Host "[OK] Wrote $out ($($files.Count) files)"
