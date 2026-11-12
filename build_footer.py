#!/usr/bin/env python3
"""Stamp the one site footer (partials/footer.html) into every Semitrical page.

WHY A STAMP AND NOT A SCRIPT INCLUDE. The site is plain HTML with no build step. Loading the
footer with JavaScript would leave it missing whenever JS fails or is blocked, and crawlers
might not see the links. Stamping keeps every page plain HTML; the footer is still defined once.

Usage:   python build_footer.py           # rewrite the pages
         python build_footer.py --check   # exit 1 if any page is out of date (no writes)

Each page holds the footer between two marker comments. On a page without markers yet, the
LAST <footer> on the page is replaced: report and deal-desk pages use <footer> inside sections
for source notes, and those must stay.

Research pieces (Semipply Research branding) and the old LegalForensics pages are deliberately
not in PAGES; they keep their own footers.
"""
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PARTIAL = ROOT / "partials" / "footer.html"
START = "<!-- footer:start (generated from partials/footer.html by build_footer.py; edit that file, not this) -->"
END = "<!-- footer:end -->"

PAGES = [
    "index.html", "about.html", "choose-suppliers.html", "contact.html", "deal-desk.html",
    "evidence.html", "markets.html", "privacy.html", "reports.html", "supplier-intelligence.html",
    "three-suppliers.html",
    "deal-desks/dram/index.html", "deal-desks/silicon-carbide/index.html",
    "reports/netapp/index.html", "reports/supplier-leverage/index.html",
    "findings/memory-2027/index.html", "suppliers/index.html", "semitrical/index.html",
]

MARKED = re.compile(re.escape("<!-- footer:start") + r".*?" + re.escape(END), re.S)
FOOTER = re.compile(r"<footer\b[^>]*>.*?</footer>", re.S)


def stamped(text: str, block: str) -> str:
    if MARKED.search(text):
        return MARKED.sub(lambda _: block, text, count=1)
    last = None
    for last in FOOTER.finditer(text):
        pass
    if last is not None:
        return text[:last.start()] + block + text[last.end():]
    # A page with the site's top bar but no footer at all (findings/memory-2027 had none).
    body_end = text.rfind("</body>")
    if body_end < 0:
        raise SystemExit("no <footer> and no </body> found")
    return text[:body_end] + block + "\n" + text[body_end:]


def main() -> int:
    check = "--check" in sys.argv
    block = START + "\n" + PARTIAL.read_text(encoding="utf-8").strip() + "\n" + END
    stale = []
    for rel in PAGES:
        path = ROOT / rel
        raw = io.open(path, encoding="utf-8", newline="").read()
        crlf = "\r\n" in raw
        text = raw.replace("\r\n", "\n")
        try:
            new = stamped(text, block)
        except SystemExit as e:
            print(f"{rel}: {e}")
            return 1
        if new != text:
            stale.append(rel)
            if not check:
                io.open(path, "w", encoding="utf-8", newline="").write(
                    new.replace("\n", "\r\n") if crlf else new)
    verb = "out of date" if check else "updated"
    print(f"{len(stale)} of {len(PAGES)} pages {verb}" + (": " + ", ".join(stale) if stale else ""))
    return 1 if (check and stale) else 0


if __name__ == "__main__":
    sys.exit(main())
