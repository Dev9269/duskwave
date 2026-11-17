# Generates Duskwave brand assets (icon, adaptive icon layers, splash, favicon).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-brand.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'assets\images'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$ink   = [System.Drawing.ColorTranslator]::FromHtml('#0B0B0F')
$ember = [System.Drawing.ColorTranslator]::FromHtml('#E4A853')
$cream = [System.Drawing.ColorTranslator]::FromHtml('#F4F1EA')

function New-Canvas([int]$size, [System.Drawing.Color]$color) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear($color)
  return @{ Bitmap = $bmp; Graphics = $g; Size = $size }
}

function Add-Crescent($g, [double]$cx, [double]$cy, [double]$r, [System.Drawing.Color]$color, [System.Drawing.Color]$carve) {
  $outer = New-Object System.Drawing.SolidBrush($color)
  $inner = New-Object System.Drawing.SolidBrush($carve)
  $g.FillEllipse($outer, [float]($cx - $r), [float]($cy - $r), [float]($r * 2), [float]($r * 2))
  $offset = $r * 0.42
  $innerR = $r * 0.92
  $g.FillEllipse($inner, [float]($cx + $offset - $innerR), [float]($cy - $innerR), [float]($innerR * 2), [float]($innerR * 2))
  $outer.Dispose()
  $inner.Dispose()
}

function Add-EqBars($g, [double]$x, [double]$cy, [double]$unit, [double[]]$heights, [System.Drawing.Color[]]$colors) {
  $w = $unit * 0.36
  $gap = $unit * 0.64
  for ($i = 0; $i -lt $heights.Count; $i++) {
    $h = $unit * $heights[$i]
    $barX = $x + ($i * ($w + $gap))
    $rect = New-Object System.Drawing.RectangleF([float]$barX, [float]($cy - $h / 2), [float]$w, [float]$h)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = $w / 2
    $path.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 180)
    $path.AddArc($rect.Right - $radius * 2, $rect.Y, $radius * 2, $radius * 2, 270, 180)
    $path.AddArc($rect.Right - $radius * 2, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 0, 180)
    $path.AddArc($rect.X, $rect.Bottom - $radius * 2, $radius * 2, $radius * 2, 90, 180)
    $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush($colors[$i % $colors.Count])
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
  }
}

function Save-Png($canvas, [string]$path) {
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

# App icon (1024): ink background, ember crescent, equalizer bars
$c = New-Canvas 1024 $ink
Add-Crescent $c.Graphics 400 480 230 $ember $ink
Add-EqBars $c.Graphics 690 480 130 @(1.0, 1.7, 2.2, 1.4) @($cream, $ember, $cream, $ember)
Save-Png $c (Join-Path $out 'icon.png')

# Adaptive foreground (1024, transparent, safe zone)
$c = New-Canvas 1024 ([System.Drawing.Color]::Transparent)
Add-Crescent $c.Graphics 430 500 175 $ember ([System.Drawing.Color]::Transparent)
Add-EqBars $c.Graphics 660 500 95 @(1.0, 1.7, 2.2, 1.4) @($cream, $ember, $cream, $ember)
Save-Png $c (Join-Path $out 'android-icon-foreground.png')

# Adaptive background (1024, ink)
$c = New-Canvas 1024 $ink
Save-Png $c (Join-Path $out 'android-icon-background.png')

# Monochrome layer (1024, white glyph on transparent)
$white = [System.Drawing.Color]::White
$c = New-Canvas 1024 ([System.Drawing.Color]::Transparent)
Add-Crescent $c.Graphics 430 500 175 $white ([System.Drawing.Color]::Transparent)
Add-EqBars $c.Graphics 660 500 95 @(1.0, 1.7, 2.2, 1.4) @($white, $white, $white, $white)
Save-Png $c (Join-Path $out 'android-icon-monochrome.png')

# Splash mark (512, transparent)
$c = New-Canvas 512 ([System.Drawing.Color]::Transparent)
Add-Crescent $c.Graphics 215 250 88 $ember ([System.Drawing.Color]::Transparent)
Add-EqBars $c.Graphics 330 250 48 @(1.0, 1.7, 2.2, 1.4) @($cream, $ember, $cream, $ember)
Save-Png $c (Join-Path $out 'splash-icon.png')

# Favicon (64): ink background, small glyph
$c = New-Canvas 64 $ink
Add-Crescent $c.Graphics 25 30 14 $ember $ink
Add-EqBars $c.Graphics 43 30 8 @(1.0, 1.8, 2.2, 1.4) @($cream, $ember, $cream, $ember)
Save-Png $c (Join-Path $out 'favicon.png')

Write-Output "Brand assets written to $out"
