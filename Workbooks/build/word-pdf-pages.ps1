param(
  [Parameter(Mandatory = $true)][string]$DocPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Pages = '1',          # e.g. '1,2,3,last'
  [int]$Width = 1275             # pixel width of each page image (150 dpi for Letter)
)
# The page as Word PRINTS it: Word saves the document as PDF (its print layout),
# and PyMuPDF draws the pages (pdf-pages.py). word-pages.ps1 draws Word's page
# metafile instead, which is quicker but does not clip what Word clips on screen
# and on paper — a kasra cut off by a fixed-height table row looks whole there.
# Opens a NEW, invisible Word (never the user's own) and quits only that one.
$py = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
if (-not (Test-Path $py)) { $py = 'python' }
$before = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object Id)
$word = New-Object -ComObject Word.Application
$mine = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $before -notcontains $_.Id } | ForEach-Object Id)
"WORD PID $mine"
New-Item -ItemType Directory -Force $OutDir | Out-Null
$pdf = Join-Path $OutDir 'export.pdf'
try {
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $d = $word.Documents.Open($DocPath, [ref]$false, [ref]$true, [ref]$false)
  if (Test-Path $pdf) { Remove-Item $pdf }
  # Save As PDF. ExportAsFixedFormat (PDF or XPS) and PrintOut never return from
  # an invisible Word on this laptop — the Acrobat PDFMaker and Kingsoft PDF
  # add-ins hook both; Save As goes round them (2026-11-06).
  $file = [string]$pdf                                         # a plain string, or COM refuses the [ref]
  $d.SaveAs2([ref]$file, [ref]17)                              # wdFormatPDF
  $d.Close([ref]0)
}
finally {
  try { $word.Quit([ref]0) } catch { "QUIT FAILED: $_" }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  Start-Sleep -Milliseconds 1500
  foreach ($id in $mine) { if (Get-Process -Id $id -ErrorAction SilentlyContinue) { Stop-Process -Id $id -Force; "KILLED leftover Word $id" } }
}
& $py (Join-Path $PSScriptRoot 'pdf-pages.py') $pdf $OutDir $Pages $Width
