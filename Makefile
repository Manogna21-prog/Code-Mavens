# ── SafeShift — Development Commands ─────────────────────────────────
# Usage: make <target>

.PHONY: help install run test lint db-up db-down docker-up docker-down clean

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Backend ──────────────────────────────────────────────────────────

install: ## Install Python dependencies
	cd backend && pip install -r requirements.txt
	cd backend && pip install pytest

run: ## Start the FastAPI dev server (port 8000)
	cd backend && uvicorn app.main:app --reload --port 8000

test: ## Run all tests with pytest
	cd backend && python -m pytest tests/ -v

lint: ## Run basic Python linting
	cd backend && python -m py_compile app/main.py
	cd backend && python -m py_compile app/models.py
	cd backend && python -m py_compile app/database.py
	@echo "✅ All files compile successfully"

# ── Database ─────────────────────────────────────────────────────────

db-up: ## Start PostgreSQL via Docker
	docker-compose up -d postgres
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	@sleep 3
	@echo "✅ PostgreSQL running on localhost:5432"

db-down: ## Stop PostgreSQL
	docker-compose stop postgres

# ── Docker (Full Stack) ──────────────────────────────────────────────

docker-up: ## Start all services (DB + API) via Docker Compose
	docker-compose up -d --build

docker-down: ## Stop all Docker services
	docker-compose down

# ── Cleanup ──────────────────────────────────────────────────────────

clean: ## Remove caches, compiled files, and Docker volumes
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	docker-compose down -v 2>/dev/null || true
	@echo "✅ Cleaned up"
