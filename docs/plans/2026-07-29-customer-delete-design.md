# Xóa khách hàng — Design

**Ngày:** 2026-07-29

## Mục tiêu

Trang Khách hàng chưa có chức năng xóa. Thêm icon xóa và logic xóa, với ràng buộc:
chỉ xóa được khách hàng **chưa có báo giá**. Khách đã có báo giá phải xóa hết báo giá
trước, rồi mới xóa được khách.

## Quyết định thiết kế

| Quyết định | Chọn | Lý do |
|---|---|---|
| UI cho khách bị chặn | Icon mờ + tooltip nêu số báo giá | Người dùng thấy ngay, không phải click thử mới biết. Ẩn hẳn icon thì gây bối rối vì hàng này có hàng kia không. |
| Quyền xóa | `admin + sales` | Giống create/update customer và delete quotation. Tránh case "sales tạo được nhưng phải gọi admin để xóa". Rủi ro thấp vì chỉ xóa được khách chưa có báo giá, tức chưa gắn dữ liệu tiền. |
| Guard | Cả frontend (disable) và backend (400) | Frontend để UX, backend để chặn race và gọi API trực tiếp. |

## 1. Backend

### `app/quotation/service.py`

Thêm `delete_customer`, theo khuôn `delete_quotation` (docstring giải thích *vì sao* bị chặn):

```python
def delete_customer(db: Session, customer_id: int) -> Optional[bool]:
    """Hard-delete a customer.

    Blocked while the customer still has quotations: those carry items,
    payments and inventory links, so deleting the customer would orphan
    them. The caller must delete the quotations first.

    Returns True on success, None if the customer does not exist. Raises
    ValueError (with a user-facing message key) when blocked.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None
    if customer.quotations:
        raise ValueError("err_customer_has_quotations")
    db.delete(customer)
    db.commit()
    return True
```

Chỉ bảng `quotations` có FK tới `customers` nên một guard này là đủ.

### `app/quotation/router.py`

Endpoint mới trong khối `# --- Customers ---`, ngay sau `update_customer_endpoint`:

```python
@router.delete("/customers/{customer_id}", status_code=204)
def delete_customer_endpoint(
    customer_id: int,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    try:
        result = delete_customer(db, customer_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
```

### `quotation_count` trong list API

`list_customers_endpoint` trả thêm `quotation_count` cho mỗi item.

**Không** tái dùng query `totals` sẵn có: nó `join(QuotationItem)` và filter
`is_trade_in == False`, nên khách chỉ có báo giá rỗng hoặc báo giá toàn dòng trade-in
sẽ bị đếm 0 → UI cho xóa sai. Cần query đếm riêng:

```python
count_rows = (
    db.query(Quotation.customer_id, sa_func.count(Quotation.id))
    .filter(Quotation.customer_id.in_(customer_ids))
    .group_by(Quotation.customer_id)
    .all()
)
counts = {row[0]: int(row[1]) for row in count_rows}
```

rồi trong vòng lặp build response: `data["quotation_count"] = counts.get(c.id, 0)`.

## 2. Frontend

### `types/index.ts`

Thêm vào `interface Customer`:

```ts
quotation_count?: number;
```

### `app/customers/page.tsx`

Thêm `const confirm = useConfirm();` cạnh `toast`, và handler theo khuôn
`handleDelete` của trang quotations:

```ts
async function handleDelete(c: Customer) {
  if (!(await confirm(t.customers_delete_prompt(c.name)))) return;
  try {
    await apiFetch(`/api/customers/${c.id}`, { method: "DELETE" });
    toast(t.customers_delete_success);
    load();
  } catch (err) {
    toast(apiError(err, t), "error");
  }
}
```

Gọi `load()` thay vì lọc state tại chỗ, vì trang này phân trang client-side từ một lần
fetch — refetch giữ `total` và số trang đúng.

Icon xóa thêm vào cell cuối, cạnh icon bút chì (đổi `w-20` → `w-24`, bọc 2 nút trong
`flex items-center gap-0.5`):

```tsx
const blocked = (c.quotation_count ?? 0) > 0;

<button onClick={() => handleDelete(c)} disabled={blocked}
  title={blocked ? t.customers_delete_blocked(c.quotation_count!) : t.customers_delete}
  className={`p-1.5 rounded-md transition-colors ${blocked
    ? "text-gray-200 cursor-not-allowed"
    : "text-gray-400 hover:bg-red-50 hover:text-red-600"}`}>
```

Icon thùng rác dùng SVG stroke `w-3.5 h-3.5` cho khớp icon bút chì. Tooltip dùng
attribute `title` của browser — trang này chưa có component tooltip riêng, không cần thêm.

### i18n (`lib/i18n/vi.ts` + `en.ts`)

Đặt sau nhóm `customers_*`:

| Key | vi |
|---|---|
| `customers_delete` | `"Xóa khách hàng"` |
| `customers_delete_prompt` | `(name: string) => \`Xóa khách hàng ${name}?\`` |
| `customers_delete_success` | `"Đã xóa khách hàng"` |
| `customers_delete_blocked` | `(n: number) => \`Khách hàng có ${n} báo giá — xóa báo giá trước\`` |
| `err_customer_has_quotations` | `"Không thể xóa khách hàng đã có báo giá. Vui lòng xóa hết báo giá trước."` |

`err_customer_has_quotations` là key backend trả về; `apiError` tự map sang locale.

## 3. Test

`backend/tests/test_customer_delete.py` (mới), style theo
`test_quotation_delete_lock.py`: docstring một dòng ở đầu, dựng data qua ORM,
`auth_headers` từ `conftest`.

```python
"""Customers can only be deleted while they have no quotations."""
```

| Test | Kỳ vọng |
|---|---|
| `test_delete_customer_without_quotations` | `204`, `db.get(Customer, id) is None` |
| `test_delete_blocked_when_quotations_exist` | `400`, khách vẫn còn trong DB |
| `test_delete_missing_customer_returns_404` | `404` |
| `test_accountant_cannot_delete_customer` | `403` (dùng fixture `accountant_user`) |
| `test_list_counts_quotation_with_only_trade_in_items` | báo giá chỉ có dòng trade-in vẫn cho `quotation_count == 1` |

Test cuối chốt lý do không gộp query count vào query `totals` — nếu về sau ai "tối ưu"
gộp lại, test sẽ đỏ.

Frontend chưa có test runner nên kiểm tra tay: xóa một khách trắng → hàng biến mất +
toast; hover icon mờ ở khách có báo giá → tooltip đúng số.

## Edge cases

- **Race** — khách vừa được tạo báo giá ở tab khác: icon vẫn bật, backend chặn 400,
  `apiError` map `err_customer_has_quotations` ra toast đỏ. Đây là lý do vẫn giữ guard
  backend dù UI đã disable.
- **FK an toàn** — `Quotation.customer_id` là non-nullable nên không có nguy cơ orphan;
  guard chỉ để đổi `IntegrityError` thành thông báo tiếng Việt.
- **Sau khi xóa hết báo giá** — quay lại trang khách hàng, `load()` chạy lại và icon tự
  sáng, không cần thao tác thêm.

## Ngoài phạm vi

Trang đang fetch `limit=100` rồi phân trang client-side nên chặn ở 100 khách. Bug có
thật nhưng độc lập với việc xóa — để PR riêng.
