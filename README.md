# QitekShop

Hệ thống quản lý cửa hàng — quản lý báo giá, tài chính, cài đặt.

**Tech stack:** Next.js (frontend) · FastAPI (backend) · MySQL (database)

## Yêu cầu

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose

## Cấu hình

Copy file `.env.example` thành `.env` và chỉnh sửa:

```bash
cp .env.example .env
```

| Biến | Mô tả | Mặc định |
|------|--------|----------|
| `MYSQL_ROOT_PASSWORD` | Mật khẩu root MySQL | — |
| `MYSQL_DATABASE` | Tên database | `qitekshop` |
| `MYSQL_PORT` | Port MySQL expose ra host | `3306` |
| `SECRET_KEY` | Secret key cho backend | — |
| `BACKEND_PORT` | Port backend | `8000` |
| `FRONTEND_PORT` | Port frontend | `3000` |
| `NEXT_PUBLIC_API_URL` | URL backend mà browser gọi tới | `http://localhost:8000` |

## Development

```bash
docker compose up --build --watch
```

Chạy ở foreground, giữ terminal mở. Khi save file:

- **Frontend:** sync `src/` + `public/` vào container → Next.js tự compile lại
- **Backend:** sync `app/` vào container → uvicorn tự restart
- **Database:** MySQL trên port `MYSQL_PORT`

Dừng: `Ctrl+C` rồi:

```bash
docker compose down
```

## Production

Build và deploy (tự hiện IP để máy khác truy cập):

```powershell
# Windows
.\deploy.ps1

# Linux/Mac
bash deploy.sh
```

Khi cập nhật code, chạy lại lệnh trên để build lại.

> **Lưu ý:** Đổi `NEXT_PUBLIC_API_URL` trong `.env` thành IP server trước khi deploy, ví dụ `http://192.168.1.100:8000`.

Dừng:

```bash
docker compose -f docker-compose.prod.yml down
```

## Cấu trúc project

```
QitekShop/
├── backend/             # FastAPI + Alembic migrations
│   ├── app/             # Source code
│   ├── alembic/         # Database migrations
│   ├── Dockerfile       # Production Dockerfile
│   └── requirements.txt
├── frontend/            # Next.js
│   ├── src/app/         # Pages (dashboard, finance, quotations, settings)
│   ├── Dockerfile       # Production multi-stage build
│   └── Dockerfile.dev   # Development Dockerfile
├── docker-compose.yml       # Development (hot-reload)
├── docker-compose.prod.yml  # Production (build required)
└── .env.example
```
