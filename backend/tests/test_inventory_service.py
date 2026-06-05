from app.inventory.models import InventoryItem, InventoryStatus
from app.inventory.schemas import InventoryItemCreate, InventoryItemUpdate
from app.inventory.service import (
    create_inventory_item, delete_inventory_item, list_inventory, update_inventory_item,
)


def test_create_defaults_in_stock(db_session):
    it = create_inventory_item(db_session, InventoryItemCreate(name="RAM", purchase_price=800_000, supplier="ACME"))
    db_session.commit()
    assert it.status == InventoryStatus.in_stock
    assert it.selling_price is None
    assert it.supplier == "ACME"


def test_list_search_name_and_serial(db_session):
    create_inventory_item(db_session, InventoryItemCreate(name="SSD", serial_number="AB-1"))
    create_inventory_item(db_session, InventoryItemCreate(name="HDD", serial_number="XY-2"))
    db_session.commit()
    items, total = list_inventory(db_session, search="ab-1")
    assert total == 1 and items[0].name == "SSD"


def test_update_changes_fields(db_session):
    it = create_inventory_item(db_session, InventoryItemCreate(name="A"))
    db_session.commit()
    up = update_inventory_item(db_session, it.id, InventoryItemUpdate(name="B", status=InventoryStatus.returned))
    db_session.commit()
    assert up.name == "B" and up.status == InventoryStatus.returned


def test_delete_ok_and_missing(db_session):
    it = create_inventory_item(db_session, InventoryItemCreate(name="X"))
    db_session.commit()
    assert delete_inventory_item(db_session, it.id) is True
    db_session.commit()
    assert db_session.query(InventoryItem).count() == 0
    assert delete_inventory_item(db_session, 999) is False
