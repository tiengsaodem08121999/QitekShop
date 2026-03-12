from datetime import date
from app.database import SessionLocal
from app.auth.models import User  # noqa: F401 - register users table
from app.finance.models import Transaction, TransactionType

TRANSACTIONS = [
    ("2026-01-03", "Thanh Toán VGA 3060", "chi", 5900000, "Ngô Lê PC"),
    ("2026-01-04", "Nhận Tiền lần 1 Anh Phong", "thu", 7000000, None),
    ("2026-01-04", "Nhận Tiền lần 1 Anh ThanhTT", "thu", 1300000, None),
    ("2026-01-06", "back tiền SSD cho anh Kiệt", "chi", 700000, None),
    ("2026-01-06", "Nhận tiền lần 2 anh Phong", "thu", 1800000, None),
    ("2026-01-06", "Gửi hàng", "chi", 84000, None),
    ("2026-01-09", "rút tiền", "chi", 280000, None),
    ("2026-01-09", "Nhận tiền anh ThanhTT lần 2", "thu", 8000000, None),
    ("2026-01-10", "Thanh Toán case anh Tâm", "chi", 10000000, None),
    ("2026-01-10", "Thanh Toán case anh Hiệp", "chi", 12000000, None),
    ("2026-01-12", "Thanh Toán nguồn 550w", "chi", 550000, "Anh Bì"),
    ("2026-01-12", "Thanh Toán 4 fan led", "chi", 200000, "Anh Bì"),
    ("2026-01-12", "Thanh Toán card mạng", "chi", 322000, "Anh Thanh TT"),
    ("2026-01-13", "Thanh Toán Laptop i7", "chi", 3000000, "Anh Chương"),
    ("2026-01-13", "Mua keo mx4 loại 20g", "chi", 430000, None),
    ("2026-01-13", "Anh Kiệt vệ sinh máy", "thu", 200000, None),
    ("2026-01-13", "Bán laptop dell", "thu", 4600000, None),
    ("2026-01-14", "Nhận tiền anh Đăng", "thu", 17300000, "PC i5 12400f 3070 ra Hà Nội"),
    ("2026-01-14", "Nhận Tiền main z690 i5 14400f ram 32gb", "thu", 10300000, "Anh Bì"),
    ("2026-01-14", "Thanh Toán Main b660 i5 12400f ssd tản", "chi", 5600000, "Anh Bì"),
    ("2026-01-14", "Anh Bì back tiền ssd", "thu", 630000, None),
    ("2026-01-15", "Thanh toán laptop i7", "chi", 1300000, "Anh Chương"),
    ("2026-01-15", "Back tiền Main Chip ram", "chi", 10300000, "Anh Bì"),
    ("2026-01-15", "thanh toán tiền ship", "chi", 35000, None),
    ("2026-01-17", "back tiền ssd cho anh Đăng", "chi", 1100000, None),
    ("2026-01-17", "Thanh toán case+tản", "chi", 600000, "Anh Bì"),
    ("2026-01-19", "Thanh toán phí ship", "chi", 85000, None),
    ("2026-01-19", "Thanh toán phí ship", "chi", 40000, None),
    ("2026-01-20", "Thanh toán hub led", "chi", 140000, None),
    ("2026-01-24", "Nhận Tiền main z690 i5 14400f ram 32gb", "thu", 11000000, "Thanh Sang"),
    ("2026-01-25", "main b365 i3 9100f vga 1030", "thu", 2000000, None),
    ("2026-01-29", "3 case", "thu", 350000, None),
]


def seed_transactions(force=False):
    db = SessionLocal()
    try:
        existing = (
            db.query(Transaction)
            .filter(
                Transaction.date >= date(2026, 1, 1),
                Transaction.date < date(2026, 2, 1),
            )
            .count()
        )
        if existing > 0:
            if not force:
                print(f"Skipped: {existing} transactions already exist for January 2026 (use --force to overwrite)")
                return
            db.query(Transaction).filter(
                Transaction.date >= date(2026, 1, 1),
                Transaction.date < date(2026, 2, 1),
            ).delete()
            print(f"Deleted {existing} existing transactions for January 2026")

        for d, desc, typ, amount, notes in TRANSACTIONS:
            db.add(
                Transaction(
                    date=date.fromisoformat(d),
                    description=desc,
                    type=TransactionType(typ),
                    amount=amount,
                    notes=notes,
                    created_by=1,
                )
            )
        db.commit()
        print(f"Inserted {len(TRANSACTIONS)} transactions for January 2026")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    seed_transactions(force="--force" in sys.argv)
