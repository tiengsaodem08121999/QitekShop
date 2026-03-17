from app.database import SessionLocal
from app.models import Setting
from app.auth.models import User, UserRole
from app.seed_transactions import seed_transactions
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"])


def seed():
    db = SessionLocal()
    try:
        defaults = {
            "initial_balance": "0",
            "shop_name": "QitekShop",
            "shop_address": "",
            "shop_phone": "",
        }
        for key, value in defaults.items():
            if not db.query(Setting).filter_by(key=key).first():
                db.add(Setting(key=key, value=value))

        if not db.query(User).filter_by(username="admin").first():
            db.add(
                User(
                    username="admin",
                    password_hash=pwd_context.hash("admin123"),
                    full_name="Admin",
                    role=UserRole.admin,
                )
            )
        db.commit()
    finally:
        db.close()

    # seed_transactions()

if __name__ == "__main__":
    seed()
