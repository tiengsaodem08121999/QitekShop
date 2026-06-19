from datetime import date
from unittest.mock import MagicMock, patch

from conftest import auth_headers

import app.quotation.email_service as email_service
from app.config import settings
from app.quotation.email_template import build_quotation_email_html
from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus
from app.quotation.service import enrich_response


def _confirmed_quotation(db, sales_user, *, email="cust@example.com"):
    cust = Customer(name="Anh Phong VT", email=email)
    db.add(cust)
    db.flush()
    q = Quotation(
        customer_id=cust.id,
        status=QuotationStatus.confirmed,
        created_by=sales_user.id,
        total_amount=8300000,
        total_trade_in=0,
    )
    db.add(q)
    db.flush()
    db.add(QuotationItem(
        quotation_id=q.id, is_trade_in=False, name="Corsair Vengeance 32GB",
        selling_price=4150000, serial_number="224400088205729",
    ))
    db.commit()
    db.refresh(q)
    return q


def _quotation_with_payment(db, sales_user, paid):
    """A confirmed quotation (total_amount 8.300.000) plus one cash payment of `paid`.
    paid == 8300000 -> remaining 0 (fully paid); paid < 8300000 -> partial."""
    from datetime import date as _date
    from app.quotation.models import Payment, PaymentMethod, PaymentType
    q = _confirmed_quotation(db, sales_user)
    db.add(Payment(
        quotation_id=q.id, amount=paid, method=PaymentMethod.cash,
        payment_type=PaymentType.payment, date=_date(2026, 6, 19),
        created_by=sales_user.id,
    ))
    db.commit()
    db.refresh(q)
    return q


def test_send_email_rejects_draft(client, sales_user, db_session):
    cust = Customer(name="A", email="a@example.com")
    db_session.add(cust)
    db_session.flush()
    q = Quotation(customer_id=cust.id, status=QuotationStatus.draft, created_by=sales_user.id)
    db_session.add(q)
    db_session.commit()
    r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))
    assert r.status_code == 400
    assert r.json()["detail"] == "err_quotation_is_draft"


def test_send_email_allowed_for_delivered(client, sales_user, db_session, monkeypatch):
    q = _confirmed_quotation(db_session, sales_user)
    q.status = QuotationStatus.delivered
    db_session.commit()
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    smtp_instance = MagicMock()
    smtp_cm = MagicMock()
    smtp_cm.__enter__.return_value = smtp_instance
    with patch.object(email_service.smtplib, "SMTP", return_value=smtp_cm):
        r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))
    assert r.status_code == 200
    assert r.json()["status"] == "sent"


def test_send_email_rejects_customer_without_email(client, sales_user, db_session):
    q = _confirmed_quotation(db_session, sales_user, email=None)
    r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))
    assert r.status_code == 400
    assert r.json()["detail"] == "err_customer_no_email"


def test_send_email_404_when_missing(client, sales_user):
    r = client.post("/api/quotations/99999/send-email", headers=auth_headers(sales_user))
    assert r.status_code == 404


def test_send_email_success(client, sales_user, db_session, monkeypatch):
    q = _confirmed_quotation(db_session, sales_user)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")
    monkeypatch.setattr(settings, "SMTP_USER", "u@test")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pw")

    smtp_instance = MagicMock()
    smtp_cm = MagicMock()
    smtp_cm.__enter__.return_value = smtp_instance
    with patch.object(email_service.smtplib, "SMTP", return_value=smtp_cm) as smtp_cls:
        r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))

    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "sent"
    assert body["to"] == "cust@example.com"
    smtp_cls.assert_called_once()
    smtp_instance.send_message.assert_called_once()


def test_logo_embedded_as_cid_not_inline(client, sales_user, db_session, monkeypatch):
    """A base64 logo must be attached via CID, not inlined as a data: URI in the
    HTML (which bloats the body and gets clipped by Gmail)."""
    from app.models import Setting
    # 1x1 transparent PNG
    png_b64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4"
               "2mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    db_session.add(Setting(key="shop_logo", value=f"data:image/png;base64,{png_b64}"))
    q = _confirmed_quotation(db_session, sales_user)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")

    smtp_instance = MagicMock()
    smtp_cm = MagicMock()
    smtp_cm.__enter__.return_value = smtp_instance
    with patch.object(email_service.smtplib, "SMTP", return_value=smtp_cm):
        r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))

    assert r.status_code == 200
    sent_msg = smtp_instance.send_message.call_args.args[0]
    # HTML references the logo by CID, never inlines the data URI
    html_part = next(p for p in sent_msg.walk() if p.get_content_type() == "text/html")
    html_body = html_part.get_content()
    assert "cid:shoplogo" in html_body
    assert "data:image/png;base64" not in html_body
    # The image rides along as a related attachment
    assert any(p.get_content_type().startswith("image/") for p in sent_msg.walk())


def test_send_email_reports_smtp_failure(client, sales_user, db_session, monkeypatch):
    import smtplib
    q = _confirmed_quotation(db_session, sales_user)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test")

    with patch.object(email_service.smtplib, "SMTP", side_effect=smtplib.SMTPException("boom")):
        r = client.post(f"/api/quotations/{q.id}/send-email", headers=auth_headers(sales_user))

    assert r.status_code == 500
    assert r.json()["detail"] == "err_email_send_failed"


def test_html_contains_key_data(db_session, sales_user):
    q = _confirmed_quotation(db_session, sales_user)
    html = build_quotation_email_html(
        enrich_response(q),
        {"shop_name": "QITEK COMPUTER", "shop_phone": "0901234567"},
        salesperson_name="Qitek Team",
    )
    assert "Anh Phong VT" in html
    assert "4.150.000đ" in html
    assert "DANH SÁCH SẢN PHẨM" in html
    assert "QITEK COMPUTER" in html
    assert "0901234567" in html
    assert "TỔNG KẾT ĐƠN HÀNG" in html
    assert "CÒN THANH TOÁN" in html
    assert "Ngày báo giá" in html
    # removed by request: quotation code + salesperson
    assert "Mã báo giá" not in html
    assert "Nhân viên" not in html


def test_icons_use_cid_when_available_else_emoji(db_session, sales_user):
    q = _confirmed_quotation(db_session, sales_user)
    enriched = enrich_response(q)
    # available -> CID image reference, no emoji
    html = build_quotation_email_html(enriched, {}, icons={"cart"})
    assert 'cid:ic_cart' in html
    assert "🛒" not in html
    # unavailable -> emoji fallback, no CID
    html2 = build_quotation_email_html(enriched, {}, icons=set())
    assert "🛒" in html2
    assert 'cid:ic_cart' not in html2


def test_paid_amount_shown_positive(db_session, sales_user):
    q = _quotation_with_payment(db_session, sales_user, paid=3000000)  # partial
    html = build_quotation_email_html(enrich_response(q), {})
    assert "Đã thanh toán" in html
    assert "3.000.000đ" in html
    assert "-3.000.000đ" not in html


def test_remaining_row_hidden_when_fully_paid(db_session, sales_user):
    q = _quotation_with_payment(db_session, sales_user, paid=8300000)  # remaining 0
    html = build_quotation_email_html(enrich_response(q), {})
    assert "CÒN THANH TOÁN" not in html


def test_remaining_row_shown_when_partial(db_session, sales_user):
    q = _quotation_with_payment(db_session, sales_user, paid=3000000)  # remaining > 0
    html = build_quotation_email_html(enrich_response(q), {})
    assert "CÒN THANH TOÁN" in html


def test_fully_paid_banner_is_green(db_session, sales_user):
    q = _quotation_with_payment(db_session, sales_user, paid=8300000)  # remaining 0
    html = build_quotation_email_html(enrich_response(q), {})
    assert "ĐƠN HÀNG ĐÃ THANH TOÁN ĐẦY ĐỦ" in html
    assert "Cảm ơn Quý khách đã hoàn tất thanh toán" in html
    # red dunning message must NOT appear when fully paid
    assert "vui lòng thanh toán số tiền còn lại" not in html
    # "Hoàn tất" subtext and the closing line are dropped when fully paid
    assert "Hoàn tất" not in html
    assert "Trân trọng cảm ơn và rất mong được phục vụ Quý khách" not in html


def test_partial_banner_still_red_message(db_session, sales_user):
    q = _quotation_with_payment(db_session, sales_user, paid=3000000)  # remaining > 0
    html = build_quotation_email_html(enrich_response(q), {})
    assert "vui lòng thanh toán số tiền còn lại" in html
    assert "ĐƠN HÀNG ĐÃ THANH TOÁN ĐẦY ĐỦ" not in html
    # closing line still present when not fully paid
    assert "Trân trọng cảm ơn và rất mong được phục vụ Quý khách" in html


def test_greeting_thanks_line_removed(db_session, sales_user):
    q = _confirmed_quotation(db_session, sales_user)
    html = build_quotation_email_html(enrich_response(q), {"shop_name": "QITEK COMPUTER"})
    assert "quan tâm sản phẩm" not in html
    # the detail intro line stays
    assert "Dưới đây là thông tin báo giá chi tiết" in html


def test_header_subtitle_removed(db_session, sales_user):
    q = _confirmed_quotation(db_session, sales_user)
    html = build_quotation_email_html(enrich_response(q), {"shop_name": "QITEK COMPUTER"})
    assert "tin tưởng lựa chọn" not in html


def test_header_title_depends_on_trade_in(db_session, sales_user):
    from app.quotation.models import QuotationItem
    q = _confirmed_quotation(db_session, sales_user)
    # no trade-in -> plain "BÁO GIÁ"
    html = build_quotation_email_html(enrich_response(q), {})
    assert "BÁO GIÁ &amp; THU CŨ ĐỔI MỚI" not in html
    # add a trade-in -> full title
    db_session.add(QuotationItem(
        quotation_id=q.id, is_trade_in=True, name="Old RAM", purchase_price=500000,
    ))
    db_session.commit()
    db_session.refresh(q)
    html2 = build_quotation_email_html(enrich_response(q), {})
    assert "THU CŨ ĐỔI MỚI" in html2
