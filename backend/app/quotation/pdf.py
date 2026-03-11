# backend/app/quotation/pdf.py
from datetime import datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

TEMPLATE_DIR = Path(__file__).parent / "templates"
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def generate_quotation_pdf(quotation, settings_dict: dict) -> bytes:
    template = env.get_template("quotation_pdf.html")

    items = [item for item in quotation.items if not item.is_trade_in]
    remaining = quotation.total_amount - quotation.total_paid - quotation.total_trade_in

    html_content = template.render(
        shop_name=settings_dict.get("shop_name", "QitekShop"),
        shop_address=settings_dict.get("shop_address", ""),
        shop_phone=settings_dict.get("shop_phone", ""),
        customer_name=quotation.customer.name,
        customer_phone=quotation.customer.phone,
        date=datetime.now(timezone.utc).strftime("%d/%m/%Y"),
        items=items,
        total_amount=quotation.total_amount,
        total_paid=quotation.total_paid,
        total_trade_in=quotation.total_trade_in,
        remaining=remaining,
    )

    return HTML(string=html_content).write_pdf()
