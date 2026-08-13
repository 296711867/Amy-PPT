param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $ProjectRoot 'build\icons'
$resourceDirectory = Join-Path $ProjectRoot 'resources'
$rendererImageDirectory = Join-Path $ProjectRoot 'src\renderer\src\assets\images'
New-Item -ItemType Directory -Force -Path $iconDirectory, $resourceDirectory, $rendererImageDirectory | Out-Null

function New-AmyPptIcon([int]$Size) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $scale = $Size / 1024.0

  function New-RoundedPath([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $diameter = $Radius * 2
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
  }

  function Fill-RoundedRect([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius, [System.Drawing.Color]$Color) {
    $path = New-RoundedPath ($X * $scale) ($Y * $scale) ($Width * $scale) ($Height * $scale) ($Radius * $scale)
    $brush = [System.Drawing.SolidBrush]::new($Color)
    $graphics.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
  }

  $apricot = [System.Drawing.ColorTranslator]::FromHtml('#F58E77')
  $cream = [System.Drawing.ColorTranslator]::FromHtml('#FFF7EF')
  $ink = [System.Drawing.ColorTranslator]::FromHtml('#27342F')
  $yellow = [System.Drawing.ColorTranslator]::FromHtml('#FFD166')

  Fill-RoundedRect 0 0 1024 1024 224 $cream
  Fill-RoundedRect 160 208 704 528 104 $ink
  Fill-RoundedRect 220 268 584 408 68 $apricot
  Fill-RoundedRect 440 766 144 48 24 $ink
  Fill-RoundedRect 326 812 372 52 26 $ink

  $aPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $aPath.AddPolygon([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(352 * $scale, 614 * $scale),
    [System.Drawing.PointF]::new(478 * $scale, 350 * $scale),
    [System.Drawing.PointF]::new(546 * $scale, 350 * $scale),
    [System.Drawing.PointF]::new(672 * $scale, 614 * $scale),
    [System.Drawing.PointF]::new(580 * $scale, 614 * $scale),
    [System.Drawing.PointF]::new(558 * $scale, 562 * $scale),
    [System.Drawing.PointF]::new(464 * $scale, 562 * $scale),
    [System.Drawing.PointF]::new(442 * $scale, 614 * $scale)
  ))
  $creamBrush = [System.Drawing.SolidBrush]::new($cream)
  $graphics.FillPath($creamBrush, $aPath)
  $holeBrush = [System.Drawing.SolidBrush]::new($apricot)
  $graphics.FillPolygon($holeBrush, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(496 * $scale, 486 * $scale),
    [System.Drawing.PointF]::new(525 * $scale, 416 * $scale),
    [System.Drawing.PointF]::new(554 * $scale, 486 * $scale)
  ))

  $yellowBrush = [System.Drawing.SolidBrush]::new($yellow)
  $graphics.FillEllipse($yellowBrush, 688 * $scale, 200 * $scale, 140 * $scale, 140 * $scale)
  $checkPen = [System.Drawing.Pen]::new($ink, [Math]::Max(2, 24 * $scale))
  $checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $checkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawLines($checkPen, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(727 * $scale, 270 * $scale),
    [System.Drawing.PointF]::new(749 * $scale, 292 * $scale),
    [System.Drawing.PointF]::new(791 * $scale, 244 * $scale)
  ))

  $checkPen.Dispose()
  $yellowBrush.Dispose()
  $holeBrush.Dispose()
  $creamBrush.Dispose()
  $aPath.Dispose()
  $graphics.Dispose()
  return $bitmap
}

function Save-Png([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-AmyImagePlaceholder {
  $width = 1600
  $height = 900
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FFFFFF'))

  $outerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FAFAF8'))
  $graphics.FillRectangle($outerBrush, 22, 22, $width - 44, $height - 44)
  $borderPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#C9C9C4'), 4)
  $borderPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  $graphics.DrawRectangle($borderPen, 54, 54, $width - 108, $height - 108)

  $iconPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#96968F'), 9)
  $iconPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $graphics.DrawRectangle($iconPen, 700, 252, 200, 154)
  $graphics.DrawEllipse($iconPen, 843, 278, 25, 25)
  $graphics.DrawLines($iconPen, [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(718, 382),
    [System.Drawing.PointF]::new(770, 326),
    [System.Drawing.PointF]::new(812, 365),
    [System.Drawing.PointF]::new(842, 336),
    [System.Drawing.PointF]::new(884, 382)
  ))

  $titleFont = [System.Drawing.Font]::new('Microsoft YaHei UI', 38, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $bodyFont = [System.Drawing.Font]::new('Microsoft YaHei UI', 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#55554F'))
  $bodyBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#92928B'))
  $center = [System.Drawing.StringFormat]::new()
  $center.Alignment = [System.Drawing.StringAlignment]::Center
  # Build CJK labels from code points so Windows PowerShell 5 code-page detection cannot corrupt them.
  $placeholderTitle = [string]::Concat([char[]]@(0x56FE, 0x7247, 0x5360, 0x4F4D))
  $placeholderBodyPrefix = [string]::Concat([char[]]@(0x53EF, 0x5728))
  $placeholderBodySuffix = [string]::Concat([char[]]@(0x7F16, 0x8F91, 0x5668, 0x4E2D, 0x66FF, 0x6362))
  $graphics.DrawString($placeholderTitle, $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(300, 464, 1000, 62), $center)
  $graphics.DrawString("$placeholderBodyPrefix Amy-PPT $placeholderBodySuffix", $bodyFont, $bodyBrush, [System.Drawing.RectangleF]::new(300, 538, 1000, 50), $center)

  $center.Dispose()
  $bodyBrush.Dispose()
  $titleBrush.Dispose()
  $bodyFont.Dispose()
  $titleFont.Dispose()
  $iconPen.Dispose()
  $borderPen.Dispose()
  $outerBrush.Dispose()
  $graphics.Dispose()
  return $bitmap
}

function Get-BigEndianBytes([int]$Value) {
  $bytes = [BitConverter]::GetBytes($Value)
  [Array]::Reverse($bytes)
  return $bytes
}

$sizes = @(16, 24, 32, 48, 64, 128, 256, 512, 1024)
$pngBySize = @{}
foreach ($size in $sizes) {
  $bitmap = New-AmyPptIcon $size
  $path = Join-Path $iconDirectory "${size}x${size}.png"
  Save-Png $bitmap $path
  $pngBySize[$size] = [IO.File]::ReadAllBytes($path)
  $bitmap.Dispose()
}

[IO.File]::WriteAllBytes((Join-Path $resourceDirectory 'amy-ppt-icon.png'), $pngBySize[1024])
[IO.File]::WriteAllBytes((Join-Path $rendererImageDirectory 'logo.png'), $pngBySize[256])
[IO.File]::WriteAllBytes((Join-Path $rendererImageDirectory 'amy-session-placeholder.png'), $pngBySize[512])
[IO.File]::WriteAllBytes((Join-Path $ProjectRoot 'thumb.png'), $pngBySize[1024])
$placeholder = New-AmyImagePlaceholder
Save-Png $placeholder (Join-Path $resourceDirectory 'amy-image-placeholder.png')
$placeholder.Dispose()

$icoSizes = @(16, 24, 32, 48, 64, 128, 256)
$icoStream = [IO.MemoryStream]::new()
$icoWriter = [IO.BinaryWriter]::new($icoStream)
$icoWriter.Write([uint16]0)
$icoWriter.Write([uint16]1)
$icoWriter.Write([uint16]$icoSizes.Count)
$icoOffset = 6 + 16 * $icoSizes.Count
foreach ($size in $icoSizes) {
  $payload = $pngBySize[$size]
  $dimension = if ($size -ge 256) { 0 } else { $size }
  $icoWriter.Write([byte]$dimension)
  $icoWriter.Write([byte]$dimension)
  $icoWriter.Write([byte]0)
  $icoWriter.Write([byte]0)
  $icoWriter.Write([uint16]1)
  $icoWriter.Write([uint16]32)
  $icoWriter.Write([uint32]$payload.Length)
  $icoWriter.Write([uint32]$icoOffset)
  $icoOffset += $payload.Length
}
foreach ($size in $icoSizes) { $icoWriter.Write($pngBySize[$size]) }
$icoWriter.Flush()
[IO.File]::WriteAllBytes((Join-Path $iconDirectory 'icon.ico'), $icoStream.ToArray())
$icoWriter.Dispose()
$icoStream.Dispose()

$icnsTypes = @{
  16 = 'icp4'
  32 = 'icp5'
  64 = 'icp6'
  128 = 'ic07'
  256 = 'ic08'
  512 = 'ic09'
  1024 = 'ic10'
}
$icnsPayloadSize = 8
foreach ($size in $icnsTypes.Keys) { $icnsPayloadSize += 8 + $pngBySize[$size].Length }
$icnsStream = [IO.MemoryStream]::new()
$icnsStream.Write([Text.Encoding]::ASCII.GetBytes('icns'), 0, 4)
$lengthBytes = Get-BigEndianBytes $icnsPayloadSize
$icnsStream.Write($lengthBytes, 0, 4)
foreach ($size in @(16, 32, 64, 128, 256, 512, 1024)) {
  $payload = $pngBySize[$size]
  $typeBytes = [Text.Encoding]::ASCII.GetBytes($icnsTypes[$size])
  $entryLength = Get-BigEndianBytes (8 + $payload.Length)
  $icnsStream.Write($typeBytes, 0, 4)
  $icnsStream.Write($entryLength, 0, 4)
  $icnsStream.Write($payload, 0, $payload.Length)
}
[IO.File]::WriteAllBytes((Join-Path $iconDirectory 'icon.icns'), $icnsStream.ToArray())
$icnsStream.Dispose()

Write-Output "Amy-PPT brand assets generated in $ProjectRoot"
