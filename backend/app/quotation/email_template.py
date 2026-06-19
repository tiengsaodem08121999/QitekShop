"""Build the customer-facing quotation email as email-safe HTML.

Table layout + inline CSS so it renders consistently across mail clients
(Gmail, Outlook, Apple Mail). Images (shop logo, QR) are referenced by CID and
attached by `email_service` — never inlined as data URIs (which Gmail clips).
"""
import calendar
import os
from datetime import date, timedelta
from decimal import Decimal
from html import escape

from app.quotation.models import PaymentType, WarrantyUnit

# Drop matching PNG files here to replace the emoji with exact icons. Each is
# attached by email_service as `cid:ic_<name>`; missing files fall back to emoji.
ICON_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "email_assets")
ICON_CID_PREFIX = "ic_"

# logical name -> (png filename, emoji fallback)
ICONS = {
    "calendar": ("calendar.png", "📅"),
    "doc": ("doc.png", "📄"),
    "user": ("user.png", "👤"),
    "person": ("person.png", "🧑‍💼"),
    "cart": ("cart.png", "🛒"),
    "recycle": ("recycle.png", "♻️"),
    "shield": ("shield.png", "🛡️"),
    "card": ("card.png", "💳"),
    "dollar": ("dollar.png", "💲"),
    "phone": ("phone.png", "📞"),
    "mail": ("mail.png", "✉️"),
    "globe": ("globe.png", "🌐"),
    "pin": ("pin.png", "📍"),
    "bank": ("bank.png", "🏦"),
    "check": ("check.png", "✅"),
    "receipt": ("receipt.png", ""),  # summary-card illustration (no emoji fallback)
}


def icon_files_present() -> set:
    """Logical icon names whose PNG file exists in ICON_ASSETS_DIR."""
    return {
        name for name, (fn, _) in ICONS.items()
        if os.path.isfile(os.path.join(ICON_ASSETS_DIR, fn))
    }


def icon_asset_path(name: str) -> str:
    return os.path.join(ICON_ASSETS_DIR, ICONS[name][0])

# --- palette (matches the in-app quotation design) ---
_NAVY = "#0c1d3d"
_NAVY2 = "#13294f"
_GREEN = "#16a34a"
_RED = "#dc2626"
_INK = "#1f2937"
_GRAY = "#6b7280"
_BORDER = "#e5e7eb"
_LIGHT = "#f4f7fb"
_BADGE_BG = "#dbeafe"
_BADGE_FG = "#1d4ed8"

_DEFAULT_SLOGAN = "Hiệu năng vượt trội – Dịch vụ tận tâm"

_WARRANTY_UNIT_VI = {
    WarrantyUnit.week: "tuần",
    WarrantyUnit.month: "tháng",
}


def _vnd(amount) -> str:
    """Format a number as Vietnamese currency: 8300000 -> '8.300.000đ'."""
    value = int(round(float(amount or 0)))
    return f"{value:,.0f}".replace(",", ".") + "đ"


def _date_vi(d) -> str:
    return d.strftime("%d/%m/%Y") if d else ""


def _esc(value) -> str:
    return escape(str(value)) if value is not None else ""


def _warranty_text(item) -> str:
    count = getattr(item, "warranty_count", None)
    unit = getattr(item, "warranty_unit", None)
    if not count or unit is None:
        return ""
    return f"{count} {_WARRANTY_UNIT_VI.get(unit, '')}".strip()


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _warranty_end(item):
    start = getattr(item, "warranty_start", None)
    count = getattr(item, "warranty_count", None)
    unit = getattr(item, "warranty_unit", None)
    if not start or not count or unit is None:
        return None
    if unit == WarrantyUnit.month:
        return _add_months(start, count)
    if unit == WarrantyUnit.week:
        return start + timedelta(weeks=count)
    return None


def build_quotation_email_html(
    enriched: dict,
    settings_dict: dict,
    salesperson_name: str = "",
    icons: set = None,
) -> str:
    """Render the quotation email body matching the QITEK quotation design.

    `icons` is the set of logical icon names available as attached PNGs (from
    `icon_files_present()`). Names not in the set fall back to their emoji.
    """
    icons = icons or set()

    def icon(name, size):
        if name in icons:
            return (f'<img src="cid:{ICON_CID_PREFIX}{name}" width="{size}" height="{size}" '
                    f'alt="" style="display:inline-block;vertical-align:middle;border:0;" />')
        return ICONS[name][1]

    customer = enriched["customer"]
    items = enriched["items"]
    payments = enriched["payments"]
    products = [i for i in items if not i.is_trade_in]
    trade_ins = [i for i in items if i.is_trade_in]

    total_products = sum((i.selling_price for i in products), Decimal(0))
    total_trade_in = enriched.get("total_trade_in") or Decimal(0)
    total_paid = enriched.get("total_paid") or Decimal(0)
    remaining = enriched.get("remaining") or Decimal(0)

    shop_name = settings_dict.get("shop_name") or "QITEK COMPUTER"
    shop_logo = settings_dict.get("shop_logo") or ""
    shop_qr = settings_dict.get("shop_qr") or ""
    shop_phone = settings_dict.get("shop_phone") or ""
    shop_email = settings_dict.get("shop_email") or ""
    shop_website = settings_dict.get("shop_website") or ""
    shop_address = settings_dict.get("shop_address") or ""
    shop_slogan = settings_dict.get("shop_slogan") or _DEFAULT_SLOGAN

    quote_date = _date_vi(enriched.get("created_at"))
    header_title = "BÁO GIÁ &amp; THU CŨ ĐỔI MỚI" if trade_ins else "BÁO GIÁ"

    def brand(height):
        if shop_logo:
            return (f'<img src="{_esc(shop_logo)}" alt="{_esc(shop_name)}" height="{height}" '
                    f'style="height:{height}px;width:auto;display:block;border:0;" />')
        return (f'<span style="font-size:22px;font-weight:800;color:#ffffff;'
                f'letter-spacing:1px;">{_esc(shop_name)}</span>')

    # ===== header =====
    header = f"""
    <tr><td style="background:{_NAVY};padding:22px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td align="left" valign="middle" width="42%">{brand(92)}</td>
        <td align="right" valign="middle">
          <div style="font-size:22px;font-weight:800;color:#ffffff;line-height:1.1;">{header_title}</div>
        </td>
      </tr></table>
    </td></tr>"""

    # ===== greeting / meta =====
    meta_rows = [
        ("calendar", "Ngày báo giá", quote_date),
    ]
    meta_html = "".join(
        f'<tr>'
        f'<td style="font-size:13px;padding:3px 6px 3px 0;">{icon(ic, 15)}</td>'
        f'<td style="font-size:13px;color:{_GRAY};padding:3px 4px;white-space:nowrap;">{_esc(label)}:</td>'
        f'<td style="font-size:13px;color:{_INK};font-weight:700;padding:3px 0 3px 6px;">{_esc(val)}</td>'
        f'</tr>'
        for ic, label, val in meta_rows
    )
    greeting = f"""
    <tr><td style="padding:24px 28px 6px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td valign="top">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td valign="top" style="padding-right:12px;font-size:26px;">{icon("person", 30)}</td>
            <td valign="top">
              <div style="font-size:17px;font-weight:800;color:{_INK};">Kính gửi: {_esc(customer.name)}</div>
              <div style="font-size:13px;color:{_GRAY};margin-top:6px;">Dưới đây là thông tin báo giá chi tiết:</div>
            </td>
          </tr></table>
        </td>
        <td valign="top" align="right">
          <table cellpadding="0" cellspacing="0" role="presentation">{meta_html}</table>
        </td>
      </tr></table>
    </td></tr>"""

    # ===== summary card =====
    if "receipt" in icons:
        receipt_art = (f'<img src="cid:{ICON_CID_PREFIX}receipt" width="96" alt="" '
                       f'style="display:block;margin:0 auto;border:0;" />')
    else:
        receipt_art = (
            f'<div style="width:98px;height:118px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 12px;">'
            f'<div style="height:6px;background:#cdd8ea;border-radius:3px;width:65%;margin:0 0 8px 0;"></div>'
            f'<div style="height:6px;background:#eef2f7;border-radius:3px;margin:0 0 8px 0;"></div>'
            f'<div style="height:6px;background:#eef2f7;border-radius:3px;width:85%;margin:0 0 8px 0;"></div>'
            f'<div style="height:6px;background:#eef2f7;border-radius:3px;width:70%;margin:0;"></div>'
            f'<div align="right" style="margin-top:14px;">'
            f'<span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:50%;background:{_GREEN};color:#ffffff;font-size:16px;font-weight:800;">$</span>'
            f'</div></div>'
        )

    def summary_line(ic_html, label, value, color, weight="700"):
        return (
            f'<tr>'
            f'<td style="font-size:15px;padding:7px 0;width:26px;">{ic_html}</td>'
            f'<td style="font-size:14px;color:{_INK};padding:7px 0;">{_esc(label)}</td>'
            f'<td align="right" style="font-size:15px;font-weight:{weight};color:{color};padding:7px 0;">{value}</td>'
            f'</tr>'
        )
    summary_lines = summary_line(icon("cart", 17), "Tổng giá trị sản phẩm", _vnd(total_products), _INK, "800")
    if total_trade_in:
        summary_lines += summary_line(icon("recycle", 17), "Giá trị thu cũ", "-" + _vnd(total_trade_in), _GREEN)
    if total_paid:
        summary_lines += summary_line(icon("card", 17), "Đã thanh toán", _vnd(total_paid), _GREEN)
    remaining_row = "" if remaining == 0 else f"""
            <tr>
              <td colspan="2" style="font-size:18px;font-weight:800;color:{_RED};padding-top:10px;">CÒN THANH TOÁN</td>
              <td align="right" style="font-size:24px;font-weight:800;color:{_RED};padding-top:10px;">{_vnd(remaining)}</td>
            </tr>"""
    summary = f"""
    <tr><td style="padding:10px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:{_LIGHT};border:1px solid {_BORDER};border-radius:12px;"><tr>
        <td style="padding:18px 22px;" valign="top">
          <div style="font-size:16px;font-weight:800;color:{_NAVY};letter-spacing:0.3px;margin-bottom:6px;">TỔNG KẾT ĐƠN HÀNG</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            {summary_lines}
            <tr><td colspan="3" style="border-top:1px solid #d7dee8;padding-top:2px;"></td></tr>
            {remaining_row}
          </table>
        </td>
        <td width="150" align="center" valign="middle">{receipt_art}</td>
      </tr></table>
    </td></tr>"""

    # ===== products =====
    def _badge(text):
        return (f'<span style="display:inline-block;background:{_BADGE_BG};color:{_BADGE_FG};'
                f'font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;">{_esc(text)}</span>')

    def product_row(idx, item):
        cell = f"padding:11px 8px;border-bottom:1px solid {_BORDER};font-size:13px;"
        wtext = _warranty_text(item)
        wend = _warranty_end(item)
        warranty_html = (_esc(wtext) or "—")
        if wend:
            warranty_html += f'<div style="font-size:11px;color:{_GRAY};">Đến {_date_vi(wend)}</div>'
        cond = _badge(item.condition) if item.condition else "—"
        return f"""
        <tr>
          <td align="center" style="{cell}color:{_GRAY};">{idx}</td>
          <td style="{cell}color:{_INK};font-weight:600;">{_esc(item.name)}</td>
          <td style="{cell}color:{_GRAY};font-family:monospace;font-size:12px;">{_esc(item.serial_number or "—")}</td>
          <td align="center" style="{cell}">{cond}</td>
          <td align="right" style="{cell}color:{_INK};">{_vnd(item.selling_price)}</td>
          <td style="{cell}color:{_INK};">{warranty_html}</td>
          <td align="right" style="{cell}color:{_INK};font-weight:700;">{_vnd(item.selling_price)}</td>
        </tr>"""

    def _th(label, align="left"):
        return (f'<th align="{align}" style="font-size:11px;color:#ffffff;font-weight:700;'
                f'padding:11px 10px;text-transform:uppercase;letter-spacing:0.3px;white-space:nowrap;">{label}</th>')

    product_rows = "".join(product_row(i + 1, it) for i, it in enumerate(products))
    products_section = f"""
    <tr><td style="padding:18px 28px 6px 28px;">
      <div style="font-size:16px;font-weight:800;color:{_NAVY};margin-bottom:10px;">{icon("cart", 18)} DANH SÁCH SẢN PHẨM</div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid {_BORDER};border-radius:10px;border-collapse:separate;overflow:hidden;">
        <tr style="background:{_NAVY};">
          {_th("STT", "center")}{_th("Sản phẩm")}{_th("S/N")}{_th("Tình trạng", "center")}{_th("Đơn giá", "right")}{_th("Bảo hành")}{_th("Thành tiền", "right")}
        </tr>
        {product_rows}
        <tr style="background:{_LIGHT};">
          <td colspan="6" align="right" style="font-size:13px;font-weight:800;color:{_INK};padding:11px 8px;">TỔNG GIÁ TRỊ SẢN PHẨM</td>
          <td align="right" style="font-size:13px;font-weight:800;color:{_INK};padding:11px 8px;">{_vnd(total_products)}</td>
        </tr>
      </table>
    </td></tr>"""

    # ===== trade-ins =====
    trade_in_section = ""
    if trade_ins:
        def trade_row(idx, item):
            cell = f"padding:11px 8px;border-bottom:1px solid {_BORDER};font-size:13px;"
            return f"""
            <tr>
              <td align="center" style="{cell}color:{_GRAY};">{idx}</td>
              <td style="{cell}color:{_INK};font-weight:600;">{_esc(item.name)}</td>
              <td align="center" style="{cell}color:{_GRAY};">{_esc(item.serial_number or "—")}</td>
              <td align="center" style="{cell}color:{_GRAY};">{_esc(item.condition or "—")}</td>
              <td align="right" style="{cell}color:{_INK};">{_vnd(item.purchase_price)}</td>
              <td align="right" style="{cell}color:{_INK};font-weight:700;">{_vnd(item.purchase_price)}</td>
            </tr>"""
        trade_rows = "".join(trade_row(i + 1, it) for i, it in enumerate(trade_ins))
        trade_in_section = f"""
        <tr><td style="padding:14px 28px 6px 28px;">
          <div style="font-size:16px;font-weight:800;color:{_NAVY};margin-bottom:10px;">{icon("recycle", 18)} THIẾT BỊ THU CŨ</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid {_BORDER};border-radius:10px;border-collapse:separate;overflow:hidden;">
            <tr style="background:{_NAVY};">
              {_th("STT", "center")}{_th("Thiết bị thu cũ")}{_th("S/N", "center")}{_th("Tình trạng", "center")}{_th("Giá thu", "right")}{_th("Thành tiền", "right")}
            </tr>
            {trade_rows}
            <tr style="background:{_LIGHT};">
              <td colspan="5" align="right" style="font-size:13px;font-weight:800;color:{_INK};padding:11px 8px;">TỔNG GIÁ TRỊ THU CŨ</td>
              <td align="right" style="font-size:13px;font-weight:800;color:{_GREEN};padding:11px 8px;">{_vnd(total_trade_in)}</td>
            </tr>
          </table>
        </td></tr>"""

    # ===== payment history (full width) =====
    payment_section = ""
    if payments:
        def pay_row(p):
            is_refund = p.payment_type == PaymentType.refund
            label = "Hoàn tiền" if is_refund else "Thanh toán đơn hàng"
            method = "Chuyển khoản" if getattr(p.method, "value", p.method) == "transfer" else "Tiền mặt"
            amt = ("-" if is_refund else "") + _vnd(p.amount)
            color = _RED if is_refund else _INK
            cell = f"padding:10px 12px;border-bottom:1px solid {_BORDER};font-size:13px;"
            return f"""
            <tr>
              <td style="{cell}color:{_GRAY};">{_date_vi(p.date)}</td>
              <td style="{cell}color:{_INK};">{label}</td>
              <td style="{cell}color:{_GRAY};">{method}</td>
              <td align="right" style="{cell}color:{color};font-weight:600;">{amt}</td>
            </tr>"""
        prows = "".join(pay_row(p) for p in payments)
        payment_section = f"""
        <tr><td style="padding:14px 28px 6px 28px;">
          <div style="font-size:16px;font-weight:800;color:{_NAVY};margin-bottom:10px;">{icon("card", 18)} LỊCH SỬ THANH TOÁN</div>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid {_BORDER};border-radius:10px;border-collapse:separate;overflow:hidden;">
            <tr style="background:{_LIGHT};">
              <th align="left" style="font-size:11px;color:{_GRAY};padding:11px 12px;text-transform:uppercase;">Ngày</th>
              <th align="left" style="font-size:11px;color:{_GRAY};padding:11px 12px;text-transform:uppercase;">Nội dung</th>
              <th align="left" style="font-size:11px;color:{_GRAY};padding:11px 12px;text-transform:uppercase;">Phương thức</th>
              <th align="right" style="font-size:11px;color:{_GRAY};padding:11px 12px;text-transform:uppercase;">Số tiền</th>
            </tr>
            {prows}
            <tr style="background:{_LIGHT};">
              <td colspan="3" style="font-size:13px;font-weight:800;color:{_INK};padding:11px 12px;">TỔNG ĐÃ THANH TOÁN</td>
              <td align="right" style="font-size:13px;font-weight:800;color:{_GREEN};padding:11px 12px;">{_vnd(total_paid)}</td>
            </tr>
          </table>
        </td></tr>"""

    # ===== amount-due banner =====
    if remaining == 0:
        paid_badge = (
            f'<span style="display:inline-block;width:34px;height:34px;line-height:34px;'
            f'text-align:center;border-radius:50%;background:{_GREEN};color:#ffffff;'
            f'font-size:18px;font-weight:800;">&#10003;</span>'
        )
        due_banner = f"""
    <tr><td style="padding:16px 28px 8px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;"><tr>
        <td valign="middle" width="42%" style="padding:18px 22px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td valign="middle" style="padding-right:12px;">{paid_badge}</td>
            <td valign="middle">
              <div style="font-size:15px;font-weight:800;color:{_GREEN};letter-spacing:0.3px;">ĐƠN HÀNG ĐÃ THANH TOÁN ĐẦY ĐỦ</div>
              <div style="font-size:13px;color:{_GRAY};margin-top:2px;">Hoàn tất</div>
            </td>
          </tr></table>
        </td>
        <td valign="middle" style="padding:18px 22px;border-left:1px solid #bbf7d0;">
          <div style="font-size:12px;color:{_GRAY};">Cảm ơn Quý khách đã hoàn tất thanh toán. Rất mong được tiếp tục phục vụ Quý khách!</div>
        </td>
      </tr></table>
    </td></tr>"""
    else:
        due_banner = f"""
    <tr><td style="padding:16px 28px 8px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#fef2f3;border:1px solid #f6c9cd;border-radius:12px;"><tr>
        <td valign="middle" width="42%" style="padding:18px 22px;">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td valign="middle" style="font-size:30px;padding-right:12px;">{icon("dollar", 32)}</td>
            <td valign="middle">
              <div style="font-size:13px;font-weight:700;color:{_INK};letter-spacing:0.3px;">SỐ TIỀN CẦN THANH TOÁN</div>
              <div style="font-size:26px;font-weight:800;color:{_RED};">{_vnd(remaining)}</div>
            </td>
          </tr></table>
        </td>
        <td valign="middle" style="padding:18px 22px;border-left:1px solid #f6c9cd;">
          <div style="font-size:12px;color:{_GRAY};">Quý khách vui lòng thanh toán số tiền còn lại để hoàn tất đơn hàng.</div>
        </td>
      </tr></table>
    </td></tr>"""

    # ===== closing + footer =====
    closing = f"""
    <tr><td style="padding:14px 28px 18px 28px;text-align:center;">
      <span style="font-size:14px;font-weight:700;color:{_NAVY};">Trân trọng cảm ơn và rất mong được phục vụ Quý khách!</span>
    </td></tr>"""

    footer_lines = []
    if shop_phone:
        footer_lines.append(("phone", f"Hotline: {_esc(shop_phone)}"))
    if shop_email:
        footer_lines.append(("mail", f"Email: {_esc(shop_email)}"))
    if shop_website:
        footer_lines.append(("globe", f"Website: {_esc(shop_website)}"))
    if shop_address:
        footer_lines.append(("pin", f"Địa chỉ: {_esc(shop_address)}"))
    footer_contacts = "".join(
        f'<div style="font-size:12px;color:#cdd8ea;padding:3px 0;">{icon(ic, 13)} {line}</div>'
        for ic, line in footer_lines
    )
    qr_cell = ""
    if shop_qr:
        qr_cell = f"""
        <td valign="middle" align="right" width="220">
          <table cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td align="right" valign="middle" style="font-size:11px;line-height:1.4;color:#cdd8ea;padding-right:12px;white-space:nowrap;">Quét mã để kết nối<br/>với {_esc(shop_name)}</td>
            <td valign="middle"><img src="{_esc(shop_qr)}" alt="QR" width="78" height="78" style="display:block;border:4px solid #ffffff;border-radius:6px;" /></td>
          </tr></table>
        </td>"""
    footer = f"""
    <tr><td style="background:{_NAVY};padding:22px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td valign="top" width="30%">
          {brand(64)}
          <div style="font-size:11px;color:#aebfd6;margin-top:8px;">{_esc(shop_slogan)}</div>
        </td>
        <td valign="top" style="padding-left:10px;">{footer_contacts}</td>
        {qr_cell}
      </tr></table>
    </td></tr>"""

    return f"""<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#eef1f5;padding:24px 0;">
    <tr><td align="center">
      <table width="860" cellpadding="0" cellspacing="0" role="presentation" style="max-width:860px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        {header}
        {greeting}
        {summary}
        {products_section}
        {trade_in_section}
        {payment_section}
        {due_banner}
        {closing}
        {footer}
      </table>
    </td></tr>
  </table>
</body></html>"""
