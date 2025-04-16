.DEFAULT_GOAL := help

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: run-backend
run-backend: ## Runs the backend locally
	cd backend && RUST_LOG=info cargo run --release

.PHONY: run-frontend
run-frontend: ## Runs the frontend locally
	cd frontend && npm run dev
