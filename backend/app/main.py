"""
SafeShift — API Server Entry Point
Parametric Income Insurance for India's LCV Delivery Partners

Run:  uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import drivers, policies, claims, triggers, pricing

app = FastAPI(
    title="SafeShift API",
    description=(
        "AI-Powered Parametric Income Insurance for India's LCV Delivery Partners. "
        "Zero-touch claims, instant UPI payouts, dual-gate verification."
    ),
    version="0.1.0",
)

# ── CORS (allow frontend to call API) ────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ─────────────────────────────────────────────────

app.include_router(drivers.router)
app.include_router(policies.router)
app.include_router(claims.router)
app.include_router(triggers.router)
app.include_router(pricing.router)


# ── Health check ─────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": "safeshift-api",
        "version": "0.1.0",
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "SafeShift API — Parametric Insurance for LCV Delivery Partners",
        "docs": "/docs",
    }
