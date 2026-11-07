"""Draw pages of a PDF to PNG with PyMuPDF.

    python pdf-pages.py <file.pdf> <out dir> [pages, e.g. 1,2,last] [width px]

Prints PAGES <count>, then SAVED <file> for each page drawn. word-pdf-pages.ps1
calls it on the PDF Word exports, which is the page as Word prints it.
"""
import sys
from pathlib import Path

import pymupdf

pdf, out = sys.argv[1], Path(sys.argv[2])
pages = sys.argv[3] if len(sys.argv) > 3 else "1"
width = int(sys.argv[4]) if len(sys.argv) > 4 else 1275

doc = pymupdf.open(pdf)
print("PAGES", doc.page_count)
out.mkdir(parents=True, exist_ok=True)
for p in pages.split(","):
    n = doc.page_count if p == "last" else int(p)
    page = doc[n - 1]
    zoom = width / page.rect.width
    file = out / f"pdf-{n:03d}.png"
    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(file)
    print("SAVED", file)
