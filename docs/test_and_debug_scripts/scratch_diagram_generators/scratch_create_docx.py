import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
import os

doc = Document()

# Set standard 1-inch margins
sections = doc.sections
for s in sections:
    s.top_margin = Inches(1.0)
    s.bottom_margin = Inches(1.0)
    s.left_margin = Inches(1.0)
    s.right_margin = Inches(1.0)

# Colors
COLOR_NAVY = RGBColor(30, 58, 138)      # #1E3A8A
COLOR_DARK = RGBColor(15, 23, 42)       # #0F172A
COLOR_MUTED = RGBColor(100, 116, 139)   # #64748B
COLOR_BLUE = RGBColor(37, 99, 235)      # #2563EB

# Helper for cell shading
def set_cell_background(cell, hex_color):
    tcPr = cell._element.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._element.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_header(title_text, subtitle_text=""):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run("SPARKOLOGY ERP — SYSTEM ARCHITECTURE SPECIFICATION")
    run.font.size = Pt(9.5)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLUE

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Pt(4)
    run_t = p_title.add_run(title_text)
    run_t.font.size = Pt(22)
    run_t.font.bold = True
    run_t.font.color.rgb = COLOR_NAVY

    if subtitle_text:
        p_sub = doc.add_paragraph()
        p_sub.paragraph_format.space_before = Pt(0)
        p_sub.paragraph_format.space_after = Pt(14)
        run_s = p_sub.add_run(subtitle_text)
        run_s.font.size = Pt(11)
        run_s.font.color.rgb = COLOR_MUTED

    # Meta Table
    tbl = doc.add_table(rows=2, cols=4)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta = [
        ("Candidate / Author", "Aditya (Teacher App & Backend)"),
        ("Deliverable", "Day 1 Technical Architecture (.docx)"),
        ("Submission Date", "November 1, 2026"),
        ("Repository", "Adityakumar747/sparkology_assigenment")
    ]
    for idx, (label, val) in enumerate(meta):
        row = idx // 2
        col = (idx % 2) * 2
        
        cell_lbl = tbl.cell(row, col)
        cell_lbl.text = label
        set_cell_background(cell_lbl, "F1F5F9")
        set_cell_margins(cell_lbl, 80, 80, 120, 120)
        p = cell_lbl.paragraphs[0]
        p.runs[0].font.size = Pt(8.5)
        p.runs[0].font.bold = True
        p.runs[0].font.color.rgb = COLOR_MUTED

        cell_val = tbl.cell(row, col + 1)
        cell_val.text = val
        set_cell_background(cell_val, "FFFFFF")
        set_cell_margins(cell_val, 80, 80, 120, 120)
        p2 = cell_val.paragraphs[0]
        p2.runs[0].font.size = Pt(8.5)
        p2.runs[0].font.bold = True
        p2.runs[0].font.color.rgb = COLOR_DARK

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

def add_heading_1(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(18)
    h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True
    run = h.add_run(text)
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = COLOR_NAVY
    return h

def add_heading_2(text):
    h = doc.add_paragraph()
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(4)
    h.paragraph_format.keep_with_next = True
    run = h.add_run(text)
    run.font.size = Pt(12)
    run.font.bold = True
    run.font.color.rgb = COLOR_BLUE
    return h

def add_paragraph(text, bold_prefix="", italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.font.size = Pt(10)
        r_b.font.bold = True
        r_b.font.color.rgb = COLOR_DARK
    r = p.add_run(text)
    r.font.size = Pt(10)
    r.font.italic = italic
    r.font.color.rgb = COLOR_DARK
    return p

def add_callout(text, bold_title="Key Takeaway:"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    c = tbl.cell(0, 0)
    set_cell_background(c, "F8FAFC")
    set_cell_margins(c, 120, 120, 160, 160)
    p = c.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    rb = p.add_run(f"{bold_title} ")
    rb.font.size = Pt(9.5)
    rb.font.bold = True
    rb.font.color.rgb = COLOR_NAVY
    r = p.add_run(text)
    r.font.size = Pt(9.5)
    r.font.color.rgb = COLOR_DARK
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

def add_image_box(image_path, caption_text, width_in_inches=6.0):
    if os.path.exists(image_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run = p_img.add_run()
        run.add_picture(image_path, width=Inches(width_in_inches))
        
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(12)
        r_cap = p_cap.add_run(f"Figure: {caption_text}")
        r_cap.font.size = Pt(8.5)
        r_cap.font.italic = True
        r_cap.font.color.rgb = COLOR_MUTED
    else:
        add_paragraph(f"[Image Missing: {image_path}]", bold_prefix="Warning: ")

print("Docx generator framework defined.")
