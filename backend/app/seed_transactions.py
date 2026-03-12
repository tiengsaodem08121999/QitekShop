from datetime import date
from app.database import SessionLocal
from app.auth.models import User  # noqa: F401 - register users table
from app.finance.models import Transaction, TransactionType

TRANSACTIONS = [
    # === December 2025 ===
    ("2025-12-01", "Nhận Cọc Anh Duy", "thu", 300000, "màn hình di động"),
    ("2025-12-01", "Thanh toán màn hình 14 in", "chi", 1200000, None),
    ("2025-12-02", "Nhận Tiền ssd 512", "thu", 700000, "Anh Kiệt Mua"),
    ("2025-12-03", "nhận tiền thanh toán 14in", "thu", 1200000, "Anh Duy Long xuyên"),
    ("2025-12-04", "trả tiền gửi hàng", "chi", 50000, None),
    ("2025-12-11", "Bán ram 16gb x2 d5 bus 4800", "thu", 2400000, None),
    ("2025-12-12", "Bán ram 8gb bus 3200", "thu", 500000, "Vinh"),
    ("2025-12-14", "mua ssd 1T", "chi", 1750000, "anh ThanhTT"),
    ("2025-12-15", "Anh Duy trả nợ", "thu", 100000, None),
    ("2025-12-16", "Anh Duy trả nợ", "thu", 100000, None),
    ("2025-12-30", "cọc vga 3060 anh Thắng", "chi", 500000, "Ngô Lê PC"),
    ("2025-12-30", "Thanh toán ram và nguồn", "chi", 1400000, "Anh Bì"),
    ("2025-12-30", "Thanh toán case", "chi", 550000, "Gia Phong PC"),

    # === January 2026 ===
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

    # === February 2026 ===
    ("2026-02-02", "Màn hình 27 in Viewsonic", "thu", 2100000, "anh Khoa LM"),
    ("2026-02-02", "Thanh toán màn 27 in Viewsonic", "chi", 1800000, "Long Ngũ Yên"),
    ("2026-02-03", "Anh ThanhTT thanh toán case", "thu", 6600000, None),
    ("2026-02-03", "Thanh toán bàn phím laptop", "chi", 490000, "Laptop i7 10th"),
    ("2026-02-04", "Thanh toán case i3 12100f main h610", "chi", 3300000, None),
    ("2026-02-08", "Thanh toán h510 + i3 10th", "chi", 1850000, None),
    ("2026-02-09", "bán main b560 ram 16gb", "thu", 2000000, None),
    ("2026-02-10", "Thanh Toán ram 16x2 fake", "chi", 3240000, None),
    ("2026-02-19", "Cọc mai chip ram tản (i3 12100f)", "thu", 100000, None),
    ("2026-02-22", "nhận tiền main chip ram (i3 12100f)", "thu", 3800000, None),
    ("2026-02-22", "ram d5 bus 5600 8x2", "thu", 2400000, None),
    ("2026-02-23", "chốt case tản 360 nguồn 650w", "thu", 2800000, "anh Hipe"),
    ("2026-02-24", "thanh toán vỏ case kèm 3 fan", "chi", 950000, "Thanh Sang"),
    ("2026-02-25", "Thanh toán phí ship", "chi", 55000, None),
    ("2026-02-26", "case i3 12100f gtx 1660s", "chi", 9900000, None),
    ("2026-02-26", "anh Phong trả tiền", "thu", 2100000, None),
    ("2026-02-26", "bán ssd 500gb new", "thu", 1500000, None),

    # === March 2026 ===
    ("2026-03-01", "Bán case trắng", "thu", 250000, None),
    ("2026-03-02", "Anh Phong trả tiền", "thu", 2000000, None),
    ("2026-03-02", "Anh ThanhTT thanh toán ram 32gb lần 1", "thu", 1000000, None),
    ("2026-03-02", "usb to jack 3.5", "chi", 70000, None),
    ("2026-03-03", "usb wifi", "chi", 134000, None),
    ("2026-03-03", "Nhận cọc 50k ram", "thu", 50000, None),
    ("2026-03-03", "2 cáp ram d4 32gb", "thu", 3650000, None),
    ("2026-03-04", "Nhận cọc ram laptop 3200", "thu", 100000, None),
    ("2026-03-04", "Laptop hp i7 10th", "thu", 7800000, None),
    ("2026-03-04", "5 phần vàng", "chi", 8800000, None),
    ("2026-03-04", "Vỏ case new", "chi", 350000, None),
    ("2026-03-04", "Anh Phong Trả tiền", "thu", 1000000, None),
    ("2026-03-05", "Hoàn tiền main chip", "chi", 4000000, "Anh Đăng (HN)"),
    ("2026-03-07", "Nhận cọc case i5 12400f 3060", "thu", 5000000, "Anh Nhất"),
    ("2026-03-07", "Cọc 3060", "chi", 500000, "Trần Thị Yến Thy"),
    ("2026-03-07", "Thanh toán ram 8gb bus 2400", "chi", 850000, None),
    ("2026-03-07", "Rút Tiền mặt", "chi", 850000, None),
    ("2026-03-07", "thanh toán main b660, ram 32gb", "chi", 5100000, None),
    ("2026-03-07", "trade main chip ram", "thu", 700000, None),
    ("2026-03-08", "bán ram laptop bus 3200", "thu", 800000, None),
    ("2026-03-09", "Cọc màn 25in", "chi", 100000, "Anh Bì"),
    ("2026-03-09", "ram 32gb lé cây", "thu", 3600000, None),
    ("2026-03-09", "thanh toán vga 3060", "chi", 5190000, None),
    ("2026-03-10", "Nhận tiền anh PhongVT z690 i9 12900k", "thu", 12000000, "TRAN DUC LUONG"),
    ("2026-03-10", "cọc tản nước", "chi", 200000, "TRAN DUC LUONG"),
    ("2026-03-10", "Thanh toán tản nước 360", "chi", 1000000, "TRAN DUC LUONG"),
    ("2026-03-10", "thanh toán z690 new", "chi", 3650000, None),
    ("2026-03-11", "Thanh Toán màn hình 25 in", "chi", 1600000, "anh Bì"),
    ("2026-03-11", "Thanh Toán chip i9 12900ks", "chi", 7100000, None),
    ("2026-03-12", "Mua 3 thanh ram 8gb bus 2400", "chi", 2700000, None),
    ("2026-03-12", "Bán ram 32gb bus 3200", "thu", 3300000, None),
]


def _seed_month(db, year, month, txns, force):
    """Seed transactions for a specific month."""
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1

    existing = (
        db.query(Transaction)
        .filter(
            Transaction.date >= date(year, month, 1),
            Transaction.date < date(next_year, next_month, 1),
        )
        .count()
    )
    if existing > 0:
        if not force:
            print(f"  Skipped {year}-{month:02d}: {existing} transactions exist (use --force)")
            return 0
        db.query(Transaction).filter(
            Transaction.date >= date(year, month, 1),
            Transaction.date < date(next_year, next_month, 1),
        ).delete()
        print(f"  Deleted {existing} existing transactions for {year}-{month:02d}")

    count = 0
    for d, desc, typ, amount, notes in txns:
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
        count += 1
    return count


def seed_transactions(force=False):
    db = SessionLocal()
    try:
        # Group transactions by (year, month)
        from collections import defaultdict
        grouped = defaultdict(list)
        for txn in TRANSACTIONS:
            d = date.fromisoformat(txn[0])
            grouped[(d.year, d.month)].append(txn)

        total = 0
        for (year, month) in sorted(grouped.keys()):
            count = _seed_month(db, year, month, grouped[(year, month)], force)
            if count:
                print(f"  Inserted {count} transactions for {year}-{month:02d}")
            total += count

        db.commit()
        if total:
            print(f"Total: {total} transactions inserted")
        else:
            print("No new transactions inserted")
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    seed_transactions(force="--force" in sys.argv)
