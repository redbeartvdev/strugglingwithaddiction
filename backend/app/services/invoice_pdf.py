"""Professional single-page invoice PDF (Pillow + raw PDF, no ReportLab)."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image


PAGE_W = 612
PAGE_H = 792

# Brand
NAVY = (0.102, 0.102, 0.180)  # #1a1a2e
RED = (0.549, 0.067, 0.149)  # #8c1126
BLUE = (0.373, 0.741, 0.965)  # #5FBDF6
GRAY = (0.420, 0.447, 0.502)  # #6b7280
LIGHT = (0.969, 0.973, 0.980)  # #f7f8fa
LINE = (0.898, 0.906, 0.922)  # #e5e7eb
BLACK = (0.12, 0.12, 0.14)
WHITE = (1.0, 1.0, 1.0)


def _esc(text: str) -> str:
    return (
        str(text or "")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("\r", " ")
        .replace("\n", " ")
    )


def _rgb(rgb: tuple[float, float, float]) -> str:
    return f"{rgb[0]:.3f} {rgb[1]:.3f} {rgb[2]:.3f}"


@dataclass
class InvoicePdfData:
    number: str
    status: str
    issued_on: str
    bill_to_name: str
    bill_to_email: str
    center_name: str
    product: str
    interval: str
    amount_label: str
    period_label: str = ""
    description: str = ""
    support_email: str = "support@strugglingwithaddiction.com"
    site_url: str = "https://strugglingwithaddiction.com"


def _resolve_logo_path() -> Path | None:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "static" / "images" / "SWA-logo-web-white-small_vSE-1.webp",
        here.parents[2] / "static" / "images" / "SWA-logo-web-white-footer_vSE.webp",
        here.parents[3] / "public" / "images" / "SWA-logo-web-white-small_vSE-1.webp",
        here.parents[3] / "public" / "images" / "SWA-logo-web-white-footer_vSE.webp",
        Path("/app/static/images/SWA-logo-web-white-small_vSE-1.webp"),
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


def _logo_jpeg_bytes(max_width: int = 220, max_height: int = 56) -> tuple[bytes, int, int] | None:
    path = _resolve_logo_path()
    if not path:
        return None
    try:
        img = Image.open(path).convert("RGBA")
        # Composite onto brand navy so white logo stays readable
        bg = Image.new("RGBA", img.size, (26, 26, 46, 255))
        composed = Image.alpha_composite(bg, img).convert("RGB")
        composed.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        import io

        buf = io.BytesIO()
        composed.save(buf, format="JPEG", quality=92)
        return buf.getvalue(), composed.width, composed.height
    except Exception:
        return None


def build_invoice_pdf(data: InvoicePdfData) -> bytes:
    """Render a branded invoice PDF with site logo, meta, bill-to, and totals."""
    ops: list[str] = []

    def fill_rect(x: float, y: float, w: float, h: float, color: tuple[float, float, float]) -> None:
        ops.append(f"{_rgb(color)} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")

    def stroke_rect(x: float, y: float, w: float, h: float, color: tuple[float, float, float], width: float = 0.8) -> None:
        ops.append(f"{_rgb(color)} RG {width:.2f} w {x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")

    def hline(x1: float, x2: float, y: float, color: tuple[float, float, float], width: float = 0.6) -> None:
        ops.append(f"{_rgb(color)} RG {width:.2f} w {x1:.2f} {y:.2f} m {x2:.2f} {y:.2f} l S")

    def text(
        x: float,
        y: float,
        value: str,
        *,
        size: float = 10,
        bold: bool = False,
        color: tuple[float, float, float] = BLACK,
    ) -> None:
        font = "F2" if bold else "F1"
        ops.append(
            f"BT /{font} {size:.1f} Tf {_rgb(color)} rg {x:.2f} {y:.2f} Td ({_esc(value)}) Tj ET"
        )

    def text_right(
        x_right: float,
        y: float,
        value: str,
        *,
        size: float = 10,
        bold: bool = False,
        color: tuple[float, float, float] = BLACK,
        approx_char_w: float | None = None,
    ) -> None:
        # Helvetica approx width for right-align without font metrics
        aw = approx_char_w if approx_char_w is not None else (size * 0.48 if not bold else size * 0.52)
        x = x_right - max(0, len(value)) * aw
        text(x, y, value, size=size, bold=bold, color=color)

    margin = 48
    content_w = PAGE_W - margin * 2

    # Header band
    header_h = 88
    fill_rect(0, PAGE_H - header_h, PAGE_W, header_h, NAVY)
    fill_rect(0, PAGE_H - header_h - 4, PAGE_W, 4, RED)

    logo = _logo_jpeg_bytes()
    if logo:
        logo_w, logo_h = logo[1], logo[2]
        logo_x = margin
        logo_y = PAGE_H - 28 - logo_h
        ops.append(f"q {logo_w} 0 0 {logo_h} {logo_x:.2f} {logo_y:.2f} cm /Im1 Do Q")
    else:
        text(margin, PAGE_H - 42, "Struggling With Addiction", size=14, bold=True, color=WHITE)
        text(margin, PAGE_H - 58, "SWA Studio", size=10, color=BLUE)

    text_right(PAGE_W - margin, PAGE_H - 40, "INVOICE", size=22, bold=True, color=WHITE, approx_char_w=12)
    status = (data.status or "-").upper()
    text_right(PAGE_W - margin, PAGE_H - 60, status, size=10, bold=True, color=BLUE, approx_char_w=6)

    y = PAGE_H - header_h - 36
    text(margin, y, f"Invoice # {data.number}", size=12, bold=True)
    text_right(PAGE_W - margin, y, f"Date  {data.issued_on}", size=10, color=GRAY, approx_char_w=5.2)
    y -= 18
    if data.period_label:
        text(margin, y, f"Billing period  {data.period_label}", size=9, color=GRAY)
        y -= 22
    else:
        y -= 8

    # From / Bill to cards
    card_h = 92
    card_gap = 16
    card_w = (content_w - card_gap) / 2
    left_x = margin
    right_x = margin + card_w + card_gap
    card_y = y - card_h

    fill_rect(left_x, card_y, card_w, card_h, LIGHT)
    fill_rect(right_x, card_y, card_w, card_h, LIGHT)
    stroke_rect(left_x, card_y, card_w, card_h, LINE)
    stroke_rect(right_x, card_y, card_w, card_h, LINE)

    text(left_x + 14, card_y + card_h - 20, "FROM", size=8, bold=True, color=RED)
    text(left_x + 14, card_y + card_h - 38, "Struggling With Addiction", size=10, bold=True)
    text(left_x + 14, card_y + card_h - 52, "SWA Studio", size=9, color=GRAY)
    text(left_x + 14, card_y + card_h - 66, data.support_email, size=8, color=GRAY)
    text(left_x + 14, card_y + card_h - 78, data.site_url.replace("https://", "").replace("http://", ""), size=8, color=GRAY)

    text(right_x + 14, card_y + card_h - 20, "BILL TO", size=8, bold=True, color=RED)
    bill_name = data.bill_to_name or data.bill_to_email or "-"
    text(right_x + 14, card_y + card_h - 38, bill_name[:42], size=10, bold=True)
    if data.bill_to_email and data.bill_to_email != bill_name:
        text(right_x + 14, card_y + card_h - 52, data.bill_to_email[:42], size=9, color=GRAY)
        next_y = card_y + card_h - 66
    else:
        next_y = card_y + card_h - 52
    if data.center_name:
        text(right_x + 14, next_y, data.center_name[:42], size=9, color=GRAY)

    y = card_y - 28

    # Line items table
    table_top = y
    row_h = 28
    header_row_h = 26
    fill_rect(margin, table_top - header_row_h, content_w, header_row_h, NAVY)
    text(margin + 12, table_top - 17, "Description", size=9, bold=True, color=WHITE)
    text(margin + 300, table_top - 17, "Interval", size=9, bold=True, color=WHITE)
    text_right(PAGE_W - margin - 12, table_top - 17, "Amount", size=9, bold=True, color=WHITE, approx_char_w=5.2)

    y = table_top - header_row_h
    fill_rect(margin, y - row_h, content_w, row_h, WHITE)
    stroke_rect(margin, y - row_h, content_w, row_h, LINE)
    product = data.product or "Subscription"
    if data.center_name:
        product = f"{product} - {data.center_name}"
    text(margin + 12, y - 18, product[:58], size=10, bold=True)
    text(margin + 300, y - 18, (data.interval or "-").title(), size=10, color=GRAY)
    text_right(PAGE_W - margin - 12, y - 18, data.amount_label, size=10, bold=True, approx_char_w=5.5)
    y -= row_h

    if data.description and data.description != data.product:
        fill_rect(margin, y - 22, content_w, 22, LIGHT)
        text(margin + 12, y - 15, data.description[:80], size=8, color=GRAY)
        y -= 22

    # Totals box
    y -= 18
    totals_w = 220
    totals_x = PAGE_W - margin - totals_w
    fill_rect(totals_x, y - 56, totals_w, 56, LIGHT)
    stroke_rect(totals_x, y - 56, totals_w, 56, LINE)
    text(totals_x + 14, y - 22, "Total due", size=10, color=GRAY)
    text_right(PAGE_W - margin - 14, y - 22, data.amount_label, size=10, color=GRAY, approx_char_w=5.5)
    hline(totals_x + 12, PAGE_W - margin - 12, y - 30, LINE)
    text(totals_x + 14, y - 48, "Amount paid", size=11, bold=True)
    text_right(PAGE_W - margin - 14, y - 48, data.amount_label, size=12, bold=True, color=RED, approx_char_w=6.2)

    # Footer
    fill_rect(0, 0, PAGE_W, 56, NAVY)
    fill_rect(0, 56, PAGE_W, 3, RED)
    text(margin, 30, "Thank you for your business.", size=9, color=WHITE)
    text(margin, 16, "Struggling With Addiction  |  SWA Studio", size=8, color=BLUE)
    text_right(PAGE_W - margin, 24, "Questions? " + data.support_email, size=8, color=WHITE, approx_char_w=4.4)

    stream = ("\n".join(ops) + "\n").encode("latin-1", errors="replace")

    # Assemble PDF objects
    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    add(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    add(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n")

    if logo:
        jpeg_bytes, lw, lh = logo
        img_obj = (
            f"6 0 obj<< /Type /XObject /Subtype /Image /Width {lw} /Height {lh} "
            f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
            f"/Length {len(jpeg_bytes)} >>stream\n"
        ).encode() + jpeg_bytes + b"\nendstream\nendobj\n"
        resources = b"/Font << /F1 5 0 R /F2 7 0 R >> /XObject << /Im1 6 0 R >>"
    else:
        img_obj = None
        resources = b"/Font << /F1 5 0 R /F2 7 0 R >>"

    add(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << " + resources + b" >> >>endobj\n"
    )
    add(f"4 0 obj<< /Length {len(stream)} >>stream\n".encode() + stream + b"\nendstream\nendobj\n")
    add(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")
    if img_obj:
        add(img_obj)  # object 6
    else:
        add(b"6 0 obj<< >>endobj\n")  # placeholder so numbering stays stable
    add(b"7 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)
