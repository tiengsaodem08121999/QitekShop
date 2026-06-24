"""Send a quotation to the customer over SMTP.

Synchronous send (the caller surfaces success/failure to the user). SMTP
credentials come from environment via `app.config.settings`. No third-party
dependency — stdlib `smtplib` + `email.message`.
"""
import base64
import binascii
import smtplib
from email.message import EmailMessage

from app.config import settings
from app.quotation.email_template import (
    ICON_CID_PREFIX,
    build_quotation_email_html,
    icon_asset_path,
    icon_files_present,
)

# settings keys holding a base64 image -> the CID used to reference it in HTML.
_CID_IMAGES = {"shop_logo": "shoplogo", "shop_qr": "shopqr"}


def _decode_image_data_url(data_url: str):
    """Parse a `data:image/...;base64,...` URL into (subtype, bytes).

    Returns None if it is not a base64 image data URL (e.g. an http URL or
    empty), so the caller leaves the src untouched.
    """
    if not data_url.startswith("data:image/"):
        return None
    try:
        header, b64 = data_url.split(",", 1)
        subtype = header[len("data:image/"):].split(";")[0] or "png"
        return subtype, base64.b64decode(b64)
    except (ValueError, binascii.Error):
        return None


def send_quotation_email(
    enriched: dict,
    settings_dict: dict,
    salesperson_name: str = "",
    payment_qrs: list | None = None,
) -> str:
    """Build and send the quotation email. Returns the recipient address.

    Raises RuntimeError if SMTP is not configured or the send fails.
    """
    customer = enriched["customer"]
    to_addr = (customer.email or "").strip()
    if not to_addr:
        raise RuntimeError("err_customer_no_email")

    if not settings.SMTP_HOST:
        raise RuntimeError("err_email_not_configured")

    from_addr = settings.SMTP_FROM or settings.SMTP_USER
    shop_name = settings_dict.get("shop_name") or "QITEK COMPUTER"

    msg = EmailMessage()
    msg["Subject"] = f"Báo giá từ {shop_name}"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(
        "Quý khách vui lòng xem báo giá ở định dạng HTML. "
        "Nếu email không hiển thị đúng, vui lòng liên hệ cửa hàng."
    )

    # A base64 data-URI image embedded inline bloats the HTML — Gmail clips the
    # body at ~102KB, breaking the whole message. Attach images (logo, QR) as
    # CID-referenced parts instead so the HTML stays small and they render.
    tmpl_settings = dict(settings_dict)
    attachments = []  # (cid, subtype, bytes)
    for key, cid in _CID_IMAGES.items():
        decoded = _decode_image_data_url(settings_dict.get(key) or "")
        if decoded is not None:
            subtype, img_bytes = decoded
            tmpl_settings[key] = f"cid:{cid}"
            attachments.append((cid, subtype, img_bytes))

    tmpl_payment_qrs = []
    for i, qr in enumerate(payment_qrs or []):
        image = getattr(qr, "image", None) or (qr.get("image") if isinstance(qr, dict) else None) or ""
        decoded = _decode_image_data_url(image)
        if decoded is None:
            continue
        subtype, img_bytes = decoded
        cid = f"payqr{i}"
        attachments.append((cid, subtype, img_bytes))
        name = getattr(qr, "name", None) or (qr.get("name") if isinstance(qr, dict) else "")
        note = getattr(qr, "note", None) or (qr.get("note") if isinstance(qr, dict) else None)
        tmpl_payment_qrs.append({"name": name, "image": f"cid:{cid}", "note": note})

    icons = icon_files_present()
    html = build_quotation_email_html(
        enriched, tmpl_settings, salesperson_name, icons=icons, payment_qrs=tmpl_payment_qrs,
    )
    msg.add_alternative(html, subtype="html")

    html_part = msg.get_payload()[-1]  # the html alternative
    for cid, subtype, img_bytes in attachments:
        html_part.add_related(img_bytes, maintype="image", subtype=subtype, cid=f"<{cid}>")
    # Attach the icon PNGs that exist on disk (others fell back to emoji).
    for name in icons:
        with open(icon_asset_path(name), "rb") as fh:
            html_part.add_related(
                fh.read(), maintype="image", subtype="png", cid=f"<{ICON_CID_PREFIX}{name}>"
            )

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise RuntimeError("err_email_send_failed") from exc

    return to_addr
