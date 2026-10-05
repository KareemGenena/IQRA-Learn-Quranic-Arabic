param(
  [Parameter(Mandatory = $true)][string]$DocPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Pages = '1',          # e.g. '1,2,3,last,last-1'
  [int]$Width = 1275,            # pixel width of each page image (150 dpi for Letter)
  [string]$Find = ''             # '|'-separated strings: report the physical page of each first match
)
# Opens a .docx read-only in a NEW, invisible Word instance (never the user's own),
# reports its page count, and draws the requested pages to PNG through Word's own
# page metafile. Quits the instance it started; if that fails, kills only that PID.
Add-Type -AssemblyName System.Drawing
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)
$word = New-Object -ComObject Word.Application
$mine = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object Id)
try {
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $d = $word.Documents.Open($DocPath, [ref]$false, [ref]$true, [ref]$false)
  $d.Repaginate()
  $count = $d.ComputeStatistics(2)                            # wdStatisticPages
  "PAGES $count"
  if ($Find) {
    foreach ($q in $Find.Split('|')) {
      $r = $d.Content
      $r.Find.ClearFormatting()
      if ($r.Find.Execute($q)) { "FOUND p{0}  {1}" -f $r.Information(3), $q } else { "MISSING  $q" }
    }
  }
  $win = $d.ActiveWindow
  $win.View.Type = 3                                          # wdPrintView
  $pane = $win.Panes.Item(1)
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  foreach ($p in $Pages.Split(',')) {
    $n = if ($p -eq 'last') { $count } elseif ($p -like 'last-*') { $count - [int]$p.Substring(5) } else { [int]$p }
    $bits = $pane.Pages.Item($n).EnhMetaFileBits
    $ms = New-Object System.IO.MemoryStream(, [byte[]]$bits)
    $mf = New-Object System.Drawing.Imaging.Metafile($ms)
    $h = [int]($Width * 11 / 8.5)
    $bmp = New-Object System.Drawing.Bitmap($Width, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
    $g.DrawImage($mf, 0, 0, $Width, $h)
    $file = Join-Path $OutDir ("page-{0:D3}.png" -f $n)
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose(); $mf.Dispose(); $ms.Dispose()
    "SAVED $file"
  }
  $d.Close([ref]0)
}
finally {
  try { $word.Quit([ref]0) } catch { "QUIT FAILED: $_" }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  Start-Sleep -Milliseconds 1500
  foreach ($id in $mine) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { Stop-Process -Id $id -Force; "KILLED leftover Word $id" } }
}
