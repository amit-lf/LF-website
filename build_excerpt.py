from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
import pypdf, io

W, H = letter
MARGIN = 44
UW = W - MARGIN * 2

def dark_page(c):
    c.setFillColor(HexColor('#09090C'))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(HexColor('#12151E'))
    c.setLineWidth(0.3)
    for x in range(0, int(W)+1, 36):
        c.line(x, 0, x, H)
    for y in range(0, int(H)+1, 36):
        c.line(0, y, W, y)

def rule(c, y, color='#1D2130'):
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(0.7)
    c.line(MARGIN, y, W-MARGIN, y)

def chip_icon(c, cx, cy, size=9):
    c.setStrokeColor(HexColor('#5B9FE8'))
    c.setFillColor(HexColor('#09090C'))
    c.setLineWidth(1.2)
    c.roundRect(cx-size, cy-size, size*2, size*2, 1.5, fill=1, stroke=1)
    for px in [cx-3.5, cx, cx+3.5]:
        c.line(px, cy+size, px, cy+size+4)
        c.line(px, cy-size, px, cy-size-4)
    for py in [cy-3.5, cy, cy+3.5]:
        c.line(cx-size, py, cx-size-4, py)
        c.line(cx+size, py, cx+size+4, py)

def wrap(c, text, font, size, x, y, max_w, color='#B0BCCC', line_h=11):
    c.setFillColor(HexColor(color))
    c.setFont(font, size)
    for line in simpleSplit(text, font, size, max_w):
        c.drawString(x, y, line)
        y -= line_h
    return y

buf = io.BytesIO()
c = canvas.Canvas(buf, pagesize=letter)

# ── PAGE 1 ──
dark_page(c)
y = H - 26

# Header
chip_icon(c, MARGIN + 11, y - 5)
c.setFillColor(HexColor('#EEF1F8'))
c.setFont('Helvetica-Bold', 18)
c.drawString(MARGIN + 28, y - 8, 'Semipply')
c.setFillColor(HexColor('#C8A96E'))
c.setFont('Helvetica', 7)
c.drawString(MARGIN + 28, y - 19, 'A PRODUCT OF LEGALFORENSICS.AI')

c.setFillColor(HexColor('#1D2130'))
c.roundRect(W - MARGIN - 96, y - 22, 96, 17, 3, fill=1, stroke=0)
c.setFillColor(HexColor('#C8A96E'))
c.setFont('Helvetica-Bold', 7)
c.drawCentredString(W - MARGIN - 48, y - 16, 'Q1 2026  \u00b7  SAMPLE EXCERPT')

y -= 36
rule(c, y)
y -= 14

c.setFillColor(HexColor('#7E8FA8'))
c.setFont('Helvetica', 8)
c.drawString(MARGIN, y, 'SEMICONDUCTOR SUPPLY CHAIN INTELLIGENCE  \u00b7  154 FILINGS ANALYZED  \u00b7  6 PILLARS  \u00b7  APR 2026')
y -= 16

c.setFillColor(HexColor('#EEF1F8'))
c.setFont('Helvetica-Bold', 20)
c.drawString(MARGIN, y, 'Supply Chain Risk Intelligence \u2014 Q1 2026')
y -= 20

rule(c, y)
y -= 14

# BOTTOM LINE
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 8)
c.drawString(MARGIN, y, 'BOTTOM LINE')
y -= 12

text = ('Analysis of 154 SEC EDGAR filings reveals that fabless semiconductor companies face significant '
        'unprotected financial exposure across all six supply chain pillars. Critical protective terms \u2014 '
        'liability caps, guaranteed capacity allocations, royalty ceilings \u2014 surfaced in only limited subsets '
        'of disclosed agreements, while companies consistently commit to financial obligations regardless of '
        'operational circumstances. Most urgent: foundry advance deposits and minimum purchase requirements '
        'combined with unconfirmed equipment delivery schedules create a cascade of financial risk when '
        'upstream tool suppliers face delays.')
y = wrap(c, text, 'Helvetica', 9, MARGIN, y, UW, '#B0BCCC', 12) - 8

rule(c, y)
y -= 13

# KEY FINDINGS
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 8)
c.drawString(MARGIN, y, 'KEY FINDINGS')
y -= 13

findings = [
    ('#8C2030', 'OSAT Liability Gap',
     'Liability caps protecting companies from assembly yield shortfalls surfaced in only a subset of filings \u2014 leaving financial exposure unlimited when production targets are missed.'),
    ('#8C2030', 'Foundry Capacity Mismatch',
     'Guaranteed capacity allocation absent despite widespread advance deposit requirements. Companies face indefinite production delays while payment obligations continue.'),
    ('#C8801A', 'Royalty Stack Risk',
     'Total royalty caps across multiple IP blocks surfaced in limited agreements \u2014 compounding obligations can accumulate without ceiling limits across a single chip design.'),
    ('#C8801A', 'WFE Cascade Risk',
     'Foundry capacity commitments frequently lack backing from confirmed equipment delivery schedules. Demand firm WFE tool timelines before accepting any capacity promise.'),
]

for dot_col, title, desc in findings:
    c.setFillColor(HexColor(dot_col))
    c.circle(MARGIN + 4, y - 2, 3.5, fill=1, stroke=0)
    c.setFillColor(HexColor('#EEF1F8'))
    c.setFont('Helvetica-Bold', 9)
    c.drawString(MARGIN + 13, y, title)
    y -= 12
    y = wrap(c, desc, 'Helvetica', 8.5, MARGIN + 13, y, UW - 13, '#7E8FA8', 11) - 5

y -= 4
rule(c, y)
y -= 13

# RISK DASHBOARD
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 8)
c.drawString(MARGIN, y, 'RISK BY COUNTERPARTY')
y -= 13

pillars = [
    ('Foundry Supply',     'HIGH RISK',  'Single-source dependency / Minimal startup leverage',   '#8C2030', '#E07080'),
    ('Advanced Materials', 'HIGH RISK',  'Constrained SiC supply / Volume lock-in risk',           '#8C2030', '#E07080'),
    ('OSAT / Assembly',    'MODERATE',   'Negotiable yield & liability terms',                      '#8C5A10', '#D4944A'),
    ('IP Licensing',       'MODERATE',   'Royalty stacking / Field-of-use restrictions',            '#8C5A10', '#D4944A'),
    ('EDA Tools',          'MODERATE',   'License lock-in / AI training data exposure',             '#8C5A10', '#D4944A'),
    ('Capital Equipment',  'MODERATE',   'Indirect WFE capacity constraints',                       '#8C5A10', '#D4944A'),
]

pw = (UW - 8) / 3
ph = 42
for i, (name, risk, desc, border_col, text_col) in enumerate(pillars):
    col = i % 3
    row = i // 3
    bx = MARGIN + col * (pw + 4)
    by = y - row * (ph + 5)
    c.setFillColor(HexColor('#0D1220'))
    c.roundRect(bx, by - ph, pw, ph, 3, fill=1, stroke=0)
    c.setStrokeColor(HexColor(border_col))
    c.setLineWidth(0.6)
    c.roundRect(bx, by - ph, pw, ph, 3, fill=0, stroke=1)
    bg = '#3D1018' if 'HIGH' in risk else '#2D2010'
    c.setFillColor(HexColor(bg))
    c.roundRect(bx + 5, by - 13, pw - 10, 10, 2, fill=1, stroke=0)
    c.setFillColor(HexColor(text_col))
    c.setFont('Helvetica-Bold', 6.5)
    c.drawCentredString(bx + pw/2, by - 10, risk)
    c.setFillColor(HexColor('#EEF1F8'))
    c.setFont('Helvetica-Bold', 8)
    c.drawCentredString(bx + pw/2, by - 23, name)
    c.setFillColor(HexColor('#7E8FA8'))
    c.setFont('Helvetica', 6.5)
    dl = simpleSplit(desc, 'Helvetica', 6.5, pw - 8)
    for di, dl_line in enumerate(dl[:2]):
        c.drawCentredString(bx + pw/2, by - 32 - di * 8, dl_line)

y = y - 2 * (ph + 5) - 8
rule(c, y)
y -= 13

# CONSTRAINT STACKING
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 8)
c.drawString(MARGIN, y, 'CONSTRAINT STACKING  \u00b7  Cross-Pillar Risk Interactions')
y -= 12

stacks = [
    ('Foundry Capacity Loss + OSAT Yield Trap',
     'Deprioritized foundry forces rushed wafer volumes through assembly. Without liability caps, you absorb unlimited financial exposure from assembly failures simultaneously with unused foundry payments.'),
    ('Materials Volume Lock + Foundry Allocation Gap',
     'SiC suppliers demand deposits and minimums while your foundry provides no capacity guarantee \u2014 dual cash drain paying for materials you cannot process, persisting 12+ months.'),
    ('WFE Delays + Royalty Payment Acceleration',
     'Foundry capacity depends on tool deliveries, but IP royalty obligations may still trigger on calendar milestones \u2014 production stalls while royalty payments continue regardless.'),
]

for title, desc in stacks:
    lines = simpleSplit(desc, 'Helvetica', 7.5, UW - 16)
    box_h = 14 + len(lines) * 10 + 6
    c.setFillColor(HexColor('#0D1525'))
    c.roundRect(MARGIN, y - box_h, UW, box_h, 3, fill=1, stroke=0)
    c.setStrokeColor(HexColor('#1D2A3A'))
    c.setLineWidth(0.5)
    c.roundRect(MARGIN, y - box_h, UW, box_h, 3, fill=0, stroke=1)
    c.setFillColor(HexColor('#C8A96E'))
    c.setFont('Helvetica-Bold', 7.5)
    c.drawString(MARGIN + 8, y - 10, title)
    c.setFillColor(HexColor('#7E8FA8'))
    c.setFont('Helvetica', 7.5)
    for li, line in enumerate(lines):
        c.drawString(MARGIN + 8, y - 20 - li * 10, line)
    y -= box_h + 5

y -= 2
rule(c, y)
y -= 12

# FOUNDER'S SHIELD TEASER
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 8)
c.drawString(MARGIN, y, "FOUNDER'S SHIELD  \u00b7  Full report includes protective clause language for all 6 pillars")
y -= 12

quote = ('"If Customer commits to minimum purchase quantities, Foundry shall guarantee dedicated capacity '
         'allocation and a yield floor. Failure to meet either guarantee triggers a proportional reduction '
         'in purchase commitment and/or a credit against future orders." \u2014 Sample: Foundry Reciprocal Clause')
lines = simpleSplit(quote, 'Helvetica-Oblique', 7.5, UW - 16)
box_h = len(lines) * 10 + 14
c.setFillColor(HexColor('#0D1220'))
c.roundRect(MARGIN, y - box_h, UW, box_h, 3, fill=1, stroke=0)
c.setStrokeColor(HexColor('#4ABFA0'))
c.setLineWidth(0.5)
c.line(MARGIN + 3, y - box_h, MARGIN + 3, y)
c.setFillColor(HexColor('#4ABFA0'))
c.setFont('Helvetica-Bold', 6.5)
c.drawString(MARGIN + 10, y - 9, 'SAMPLE CLAUSE  \u00b7  FOUNDRY')
c.setFillColor(HexColor('#B0BCCC'))
c.setFont('Helvetica-Oblique', 7.5)
for li, line in enumerate(lines):
    c.drawString(MARGIN + 10, y - 19 - li * 10, line)
y -= box_h + 6

# FOOTER
rule(c, y, '#262C3D')
y -= 11
c.setFillColor(HexColor('#7A6540'))
c.setFont('Helvetica', 7)
c.drawString(MARGIN, y, 'Based on 10-K filings & EX-10 material contracts from SEC EDGAR  \u00b7  154 filings  \u00b7  legalforensics.ai')
c.setFillColor(HexColor('#5B9FE8'))
c.setFont('Helvetica-Bold', 7)
c.drawRightString(W - MARGIN, y, 'Full report \u2192 legalforensics.ai')
y -= 11
c.setFillColor(HexColor('#3A3A50'))
c.setFont('Helvetica', 6)
c.drawCentredString(W/2, y, 'SAMPLE EXCERPT  \u00b7  CONFIDENTIAL  \u00b7  Not for redistribution  \u00b7  \u00a9 2026 LegalForensics AI  \u00b7  Not legal advice')

c.save()

# Write output
reader = pypdf.PdfReader(buf)
writer = pypdf.PdfWriter()
writer.add_page(reader.pages[0])

out = r'C:/Users/amitn/repos/LF-website/assets/semipply-sample-excerpt.pdf'
with open(out, 'wb') as f:
    writer.write(f)

print(f'Done. Page bottom at y={y:.0f} (margin={MARGIN}). File: {out}')
