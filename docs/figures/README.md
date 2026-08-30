# Figures for TEST-00-REPORT.pdf

Crops taken from the two screen recordings in `runs/`, at native resolution
then upscaled 6x (lanczos + mild unsharp). The source recordings are 640x400,
so UI text is soft but legible; every figure caption names its source file and
timestamp.

Rebuild the PDF with:

    node scripts/build-report-pdf.mjs docs/figures docs/TEST-00-REPORT.pdf

The build fails loudly if any figure anchor stops matching the markdown
exactly once, so the PDF cannot silently drift from the report text.
