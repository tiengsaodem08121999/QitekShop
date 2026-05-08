"""Tests for QuotationItemCreate warranty validation."""
import pytest
from pydantic import ValidationError

from app.quotation.schemas import QuotationItemCreate


def _base(**overrides):
    base = {"name": "i7 8700", "purchase_price": 0, "selling_price": 0}
    base.update(overrides)
    return base


def test_both_warranty_fields_null_is_ok():
    item = QuotationItemCreate(**_base())
    assert item.warranty_count is None
    assert item.warranty_unit is None


def test_both_warranty_fields_set_is_ok():
    item = QuotationItemCreate(**_base(warranty_count=6, warranty_unit="month"))
    assert item.warranty_count == 6
    assert item.warranty_unit.value == "month"


def test_warranty_count_without_unit_rejected():
    with pytest.raises(ValidationError):
        QuotationItemCreate(**_base(warranty_count=6))


def test_warranty_unit_without_count_rejected():
    with pytest.raises(ValidationError):
        QuotationItemCreate(**_base(warranty_unit="month"))


@pytest.mark.parametrize("bad_count", [0, 100, -1, 1000])
def test_warranty_count_out_of_range_rejected(bad_count):
    with pytest.raises(ValidationError):
        QuotationItemCreate(**_base(warranty_count=bad_count, warranty_unit="month"))


@pytest.mark.parametrize("good_count", [1, 6, 12, 99])
def test_warranty_count_in_range_accepted(good_count):
    item = QuotationItemCreate(**_base(warranty_count=good_count, warranty_unit="month"))
    assert item.warranty_count == good_count


def test_trade_in_with_null_warranty_ok():
    """Trade-ins legitimately have both warranty fields NULL — must not be rejected."""
    item = QuotationItemCreate(**_base(is_trade_in=True))
    assert item.warranty_count is None
    assert item.warranty_unit is None
