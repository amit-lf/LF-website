#!/usr/bin/env bash
# Regenerate the brief PDFs. Run from the repo root whenever a brief changes.
#
#   bash tools/make-pdfs.sh
#
# Chrome renders them; the cover page, the watermark and the print palette live in each
# brief's own <style>, and the running header and page numbers come from topdf.js. The output
# paths are unguessable because the PDF is emailed rather than linked -- NOT because the
# content is protected. The same brief is free to read on the web.
set -e
cd "$(dirname "$0")/.."
N="node --experimental-websocket tools/topdf.js"
$N "http://127.0.0.1:9334/deal-desks/dram/" \
   "d/9f3c71a4e85b2d60/semitrical-dram-deal-brief.pdf" \
   "DRAM negotiation brief" "evidence to 3 Nov 2026"
$N "http://127.0.0.1:9334/deal-desks/silicon-carbide/" \
   "d/5c82be03a7146df9/semitrical-sic-deal-brief.pdf" \
   "SiC deal brief" "evidence to 24 Oct 2026"
# Company-specific position report. NOT linked from the site -- it names a prospect, so it is
# sent rather than published, and it carries no PDF-request form for the same reason.
$N "http://127.0.0.1:9334/reports/netapp/" \
   "d/d1c4da632ee493c5/semitrical-netapp-supplier-position.pdf" \
   "NetApp's five suppliers" "evidence to 6 Nov 2026"
