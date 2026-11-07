Add-Type -AssemblyName System.Drawing

# Load the source image
$srcPath = "D:\Project\freelance\IMG-20250930-WA0008.png"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

Write-Output "Source image: $($srcImg.Width)x$($srcImg.Height)"

# Create square icons (icon.png and adaptive-icon.png) - 1024x1024
$squareSize = 1024
$squareIcons = @("icon.png", "adaptive-icon.png")

foreach ($iconName in $squareIcons) {
    # Create a new square bitmap with white background
    $bitmap = New-Object System.Drawing.Bitmap($squareSize, $squareSize)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # Set high quality rendering
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Fill with white background
    $graphics.Clear([System.Drawing.Color]::White)
    
    # Calculate dimensions to fit image in square while maintaining aspect ratio
    $aspectRatio = $srcImg.Width / $srcImg.Height
    if ($aspectRatio -gt 1) {
        $newWidth = $squareSize
        $newHeight = [int]($squareSize / $aspectRatio)
    } else {
        $newHeight = $squareSize
        $newWidth = [int]($squareSize * $aspectRatio)
    }
    
    # Center the image
    $x = [int](($squareSize - $newWidth) / 2)
    $y = [int](($squareSize - $newHeight) / 2)
    
    # Draw the image
    $graphics.DrawImage($srcImg, $x, $y, $newWidth, $newHeight)
    
    # Save as PNG
    $bitmap.Save($iconName, [System.Drawing.Imaging.ImageFormat]::Png)
    
    Write-Output "Created $iconName : $squareSize x $squareSize (PNG format)"
    
    # Cleanup
    $bitmap.Dispose()
    $graphics.Dispose()
}

# Create splash-icon.png (keep original dimensions but convert to PNG)
$splashBitmap = New-Object System.Drawing.Bitmap($srcImg.Width, $srcImg.Height)
$splashGraphics = [System.Drawing.Graphics]::FromImage($splashBitmap)
$splashGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$splashGraphics.DrawImage($srcImg, 0, 0, $srcImg.Width, $srcImg.Height)
$splashBitmap.Save("splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "Created splash-icon.png : $($srcImg.Width)x$($srcImg.Height) (PNG format)"
$splashBitmap.Dispose()
$splashGraphics.Dispose()

# Cleanup source image
$srcImg.Dispose()

Write-Output "`nAll PNG files created successfully!"
Write-Output "Verifying files..."

# Verify the created files
Get-ChildItem *.png -Exclude favicon.png, create-icons.ps1 | ForEach-Object {
    $img = [System.Drawing.Image]::FromFile($_.FullName)
    $pngGuid = [System.Drawing.Imaging.ImageFormat]::Png.Guid
    $isPng = $img.RawFormat.Guid -eq $pngGuid
    Write-Output "$($_.Name): $($img.Width)x$($img.Height), Is PNG: $isPng"
    $img.Dispose()
}

