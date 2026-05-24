$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $root 'Menyu'
$targetDir = Join-Path $sourceDir 'previews'

if (-not (Test-Path $sourceDir)) {
    throw "Source folder not found: $sourceDir"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' }

$files = Get-ChildItem -Path $sourceDir -File |
    Where-Object { $_.Extension -match '^\.(png|jpe?g|webp)$' }
$count = 0
$savedBytes = 0L

foreach ($file in $files) {
    $outputPath = Join-Path $targetDir ($file.BaseName + '.jpg')
    $sourceInfo = Get-Item $file.FullName
    $needsRebuild = -not (Test-Path $outputPath) -or ((Get-Item $outputPath).LastWriteTimeUtc -lt $sourceInfo.LastWriteTimeUtc)
    if (-not $needsRebuild) { continue }

    try {
        $image = [System.Drawing.Image]::FromFile($file.FullName)
    } catch {
        Write-Warning "Skipped unsupported image: $($file.Name)"
        continue
    }
    try {
        $maxSize = 420.0
        $scale = [Math]::Min(1.0, $maxSize / [Math]::Max($image.Width, $image.Height))
        $width = [Math]::Max(1, [int][Math]::Round($image.Width * $scale))
        $height = [Math]::Max(1, [int][Math]::Round($image.Height * $scale))

        $bitmap = New-Object System.Drawing.Bitmap $width, $height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($image, 0, 0, $width, $height)

            $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
            $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                [System.Drawing.Imaging.Encoder]::Quality,
                68L
            )
            $bitmap.Save($outputPath, $jpegCodec, $encoderParams)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    } finally {
        $image.Dispose()
    }

    $count++
    $savedBytes += [Math]::Max(0, $sourceInfo.Length - (Get-Item $outputPath).Length)
}

[pscustomobject]@{
    processed = $count
    sourceCount = $files.Count
    targetDir = $targetDir
    savedMb = [Math]::Round($savedBytes / 1MB, 2)
}
