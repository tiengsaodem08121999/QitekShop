from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.quotation.router import router as quotation_router
from app.finance.router import router as finance_router
from app.settings_router import router as settings_router
from app.dashboard_router import router as dashboard_router
from app.schedule.router import router as schedule_router

app = FastAPI(title="QitekComputer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(quotation_router)
app.include_router(finance_router)
app.include_router(settings_router)
app.include_router(dashboard_router)
app.include_router(schedule_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
