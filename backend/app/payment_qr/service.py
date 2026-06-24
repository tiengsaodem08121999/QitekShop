from typing import Optional

from sqlalchemy.orm import Session

from app.payment_qr.models import PaymentQr
from app.payment_qr.schemas import PaymentQrCreate, PaymentQrUpdate


def list_payment_qrs(db: Session) -> list[PaymentQr]:
    return db.query(PaymentQr).order_by(PaymentQr.id).all()


def get_payment_qr(db: Session, qr_id: int) -> Optional[PaymentQr]:
    return db.query(PaymentQr).filter(PaymentQr.id == qr_id).first()


def create_payment_qr(db: Session, data: PaymentQrCreate) -> PaymentQr:
    qr = PaymentQr(name=data.name, image=data.image, note=data.note)
    db.add(qr)
    db.commit()
    db.refresh(qr)
    return qr


def update_payment_qr(db: Session, qr_id: int, data: PaymentQrUpdate) -> Optional[PaymentQr]:
    qr = get_payment_qr(db, qr_id)
    if not qr:
        return None
    qr.name = data.name
    qr.image = data.image
    qr.note = data.note
    db.commit()
    db.refresh(qr)
    return qr


def delete_payment_qr(db: Session, qr_id: int) -> bool:
    qr = get_payment_qr(db, qr_id)
    if not qr:
        return False
    db.delete(qr)
    db.commit()
    return True
