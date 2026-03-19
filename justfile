# comet-server commands

app := "comet-server"

# ── Development ──────────────────────────────────────────────────────────

# Start dev server
dev:
    bun run dev

# Run tests
test:
    bun test

# Run tests in watch mode
test-watch:
    bun test --watch

# Install all dependencies (server + admin + dashboard)
install:
    bun install
    cd admin-ui && bun install
    cd dashboard-ui && bun install

# Generate Drizzle migration after schema changes
db-generate:
    bunx drizzle-kit generate

# Push schema directly to dev database (no migration file)
db-push:
    bunx drizzle-kit push

# Open Drizzle Studio
db-studio:
    bunx drizzle-kit studio

# ── Fly.io ───────────────────────────────────────────────────────────────

# Deploy to Fly
deploy:
    fly deploy

# Deploy without build cache
deploy-fresh:
    fly deploy --no-cache

# Open the deployed app in browser
open:
    fly apps open --app {{app}}

# Show app status
status:
    fly status --app {{app}}

# Tail production logs
logs:
    fly logs --app {{app}}

# Open a console on a running machine
ssh:
    fly ssh console --app {{app}}

# List secrets
secrets:
    fly secrets list --app {{app}}

# Set a secret (usage: just set-secret KEY=VALUE)
set-secret *ARGS:
    fly secrets set --app {{app}} {{ARGS}}

# Scale VM memory (usage: just scale-memory 2gb)
scale-memory size:
    fly scale memory {{size}} --app {{app}}

# Show current VM scale
scale:
    fly scale show --app {{app}}

# Run database migrations
migrate:
    fly ssh console --app {{app}} -C "cd /app && bun run drizzle-kit migrate"

# Proxy to the remote database (localhost:15432)
db-proxy:
    fly proxy 15432:5432 --app {{app}}

# ── Build ────────────────────────────────────────────────────────────────

# Build landing page CSS
build-css:
    bun run build:css

# Build admin UI
build-admin:
    cd admin-ui && bun run build

# Build dashboard UI
build-dashboard:
    cd dashboard-ui && bun run build

# Build everything
build: build-css build-admin build-dashboard
