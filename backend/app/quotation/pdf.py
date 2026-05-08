# backend/app/quotation/pdf.py
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.quotation.models import WarrantyUnit

TEMPLATE_DIR = Path(__file__).parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def _format_warranty_vi(count, unit) -> str:
    """Format warranty for the Vietnamese-only PDF. Empty string if either field is None."""
    if count is None or unit is None:
        return ""
    label = "tháng" if unit == WarrantyUnit.month else "tuần"
    return f"{count} {label}"


def _to_template_item(item):
    """Project a QuotationItem ORM row to an attribute-accessible view with derived warranty."""
    return SimpleNamespace(
        name=item.name,
        condition=item.condition,
        selling_price=item.selling_price,
        warranty=_format_warranty_vi(item.warranty_count, item.warranty_unit),
        notes=item.notes,
    )


def generate_quotation_pdf(quotation, settings_dict: dict) -> bytes:
    template = env.get_template("quotation_pdf.html")

    items = [_to_template_item(item) for item in quotation.items if not item.is_trade_in]
    remaining = quotation.total_amount - quotation.total_paid - quotation.total_trade_in

    html_content = template.render(
        shop_name=settings_dict.get("shop_name", "QitekComputer"),
        shop_address=settings_dict.get("shop_address", ""),
        shop_phone=settings_dict.get("shop_phone", ""),
        customer_name=quotation.customer.name,
        customer_phone=quotation.customer.phone,
        date=datetime.now(timezone.utc).strftime("%d-%m-%Y"),
        items=items,
        total_amount=quotation.total_amount,
        total_paid=quotation.total_paid,
        total_trade_in=quotation.total_trade_in,
        remaining=remaining,
    )

    return HTML(string=html_content).write_pdf()
