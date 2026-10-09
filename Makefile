export LOCAL_UID := $(shell id -u)
export LOCAL_GID := $(shell id -g)

COMPOSE := docker compose

.PHONY: install dev stop test build format-check check

install:
	$(COMPOSE) run --rm tooling npm ci --ignore-scripts

dev:
	$(COMPOSE) up -d dev preview

stop:
	$(COMPOSE) down

test:
	$(COMPOSE) run --rm check npm test -- --watch=false

build:
	$(COMPOSE) run --rm check npm run build

format-check:
	$(COMPOSE) run --rm check npm run format:check

check: test build format-check
