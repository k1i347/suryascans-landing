$ErrorActionPreference = "Stop"

$dir = Join-Path (Get-Location) "cover"
$out = Join-Path $dir "covers.json"

if (!(Test-Path $dir)) {
  Write-Host "[WARN] Folder 'cover' not found. Skipping."
  exit 0
}

# Supported extensions
$exts = @(".jpg", ".jpeg", ".png", ".webp", ".gif")

function Get-Images($folder) {
  if (!(Test-Path $folder)) {
    return @()
  }

  return Get-ChildItem -Path $folder -File |
    Where-Object { $exts -contains $_.Extension.ToLower() } |
    Sort-Object Name |
    Select-Object -ExpandProperty Name
}

function Title-FromFilename($filename) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($filename)

  # Một số file bị dính "đuôi" extension trong tên (vd: Global-Martial-Artsjpg.jpg)
  # => cắt bỏ nếu phần cuối tên file trùng với 1 extension ảnh phổ biến.
  $extLike = '(?i)(jpg|jpeg|png|webp|gif)$'
  while (($base.Length -gt 4) -and ($base -match $extLike)) {
    $base = $base -replace $extLike, ''
  }

  $title = $base -replace "[-_]+", " " -replace "\s+", " "
  return $title.Trim()
}

# Ưu tiên quét cover/manhwa và cover/manhua. Nếu không có ảnh nào, fallback quét trực tiếp cover/
$manhwaDir = Join-Path $dir "manhwa"
$manhuaDir = Join-Path $dir "manhua"

$manhwaFiles = Get-Images $manhwaDir
$manhuaFiles = Get-Images $manhuaDir

if (($manhwaFiles.Count -eq 0) -and ($manhuaFiles.Count -eq 0)) {
  $rootFiles = Get-Images $dir
  # Output đúng format bạn yêu cầu: chỉ có 2 key "manhwa" và "manhua".
  # Dùng [ordered] để giữ thứ tự key (manhwa trước, manhua sau).
  $data = [ordered]@{
    manhwa = $rootFiles | ForEach-Object { @{ file = $_; title = Title-FromFilename $_ } }
    manhua = @()
  }
  $counts = @{ manhwa = $rootFiles.Count; manhua = 0 }
} else {
  $data = [ordered]@{
    manhwa = $manhwaFiles | ForEach-Object { @{ file = "manhwa/$($_)"; title = Title-FromFilename $_ } }
    manhua = $manhuaFiles | ForEach-Object { @{ file = "manhua/$($_)"; title = Title-FromFilename $_ } }
  }
  $counts = @{ manhwa = $manhwaFiles.Count; manhua = $manhuaFiles.Count }
}

($data | ConvertTo-Json -Depth 5) | Out-File -FilePath $out -Encoding utf8

Write-Host ("[OK] Wrote {0} (manhwa: {1}, manhua: {2})" -f $out, $counts.manhwa, $counts.manhua)
