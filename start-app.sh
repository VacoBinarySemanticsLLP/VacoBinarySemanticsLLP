#!/usr/bin/env bash
#
# start-app.sh — Manage the GitHub Org Stats Dashboard (Node.js + Docker)
#
# Commands:
#   start   [--docker] [--native] [--build] [--port N] [--dev]
#   stop
#   logs
#   status
#   clear
#   build   Build Docker image only
#

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors & UI
# ---------------------------------------------------------------------------
C_RED='\033[1;31m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_BLUE='\033[1;34m'
C_MAGENTA='\033[1;35m'
C_CYAN='\033[0;36m'
C_WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

PALETTE=("$C_RED" "$C_GREEN" "$C_YELLOW" "$C_BLUE" "$C_MAGENTA" "$C_CYAN" "$C_WHITE")
COLOR="${PALETTE[$RANDOM % ${#PALETTE[@]}]}"

ICON_WAIT="${COLOR}⚙${NC}"
ICON_OK="${COLOR}✔${NC}"

step()      { echo -ne "  ${ICON_WAIT}  $1... "; }
step_done() { echo -e "\r  ${ICON_OK}  $1    "; }
step_err()  { echo -e "\r  ${ICON_OK}  $1    "; [[ -n "${2:-}" ]] && echo -e "      ${COLOR}└─ Error: $2${NC}"; }
info()      { echo -e "  ${ICON_WAIT}  $*"; }
warn()      { echo -e "  ${ICON_OK}  ${COLOR}$*${NC}"; }
error()     { echo -e "  ${ICON_OK}  ${COLOR}${BOLD}$*${NC}" >&2; exit 1; }

hr()        { echo -e "${DIM}────────────────────────────────────────────────────────────────────────────────${NC}"; }

banner() {
    clear
    echo -e "${COLOR}${BOLD}"
    echo "  ██████╗ ██╗████████╗██╗  ██╗██╗   ██╗██████╗"
    echo "  ██╔════╝ ██║╚══██╔══╝██║  ██║██║   ██║██╔══██╗"
    echo "  ██║  ███╗██║   ██║   ███████║██║   ██║██████╔╝"
    echo "  ██║   ██║██║   ██║   ██╔══██║██║   ██║██╔══██╗"
    echo "  ╚██████╔╝██║   ██║   ██║  ██║╚██████╔╝██║  ██║"
    echo "   ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝"
    echo ""
    echo -e "  ${DIM}GitHub Org Stats Dashboard${NC}"
    echo ""
}

show_help() {
    echo ""
    echo -e "  ${BOLD}Usage:${NC} ./start-app.sh <command> [options]"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo "    start    Launch services (defaults to Docker)"
    echo "    build    Build Docker image only"
    echo "    stop     Gracefully stop running services"
    echo "    logs     Stream live logs (Ctrl+C to exit)"
    echo "    status   Show running status"
    echo "    clear    Truncate log files"
    echo ""
    echo -e "  ${BOLD}Start options:${NC}"
    echo "    --docker        Use Docker Compose (default)"
    echo "    --native        Run locally via npm scripts"
    echo "    --build         Force rebuild of Docker image before start"
    echo "    --dev           Use nodemon (npm run dev) [native only]"
    echo "    --port <port>   Set server PORT (default: from .env or 3000) [native only]"
    echo ""
    echo -e "  ${BOLD}Docker behavior:${NC}"
    echo "    - Uses docker-compose.yml in repo root"
    echo "    - Default start runs: docker compose up -d --build"
    echo "    - 'build' runs 'docker compose build --no-cache'"
    echo ""
}

# ---------------------------------------------------------------------------
# Paths & Defaults
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
PID_FILE="$PROJECT_DIR/.app.pids"

SERVER_PORT="${PORT:-3000}"
DEV_MODE=false
USE_DOCKER=true
FORCE_BUILD=true

# ---------------------------------------------------------------------------
# Command Parsing
# ---------------------------------------------------------------------------
COMMAND="${1:-start}"
shift || true

case "$COMMAND" in
    start|stop|logs|status|clear|build) ;;
    -h|--help) show_help; exit 0 ;;
    *) error "Unknown command: '$COMMAND'. Use: start | stop | logs | status | clear | build" ;;
esac

while [[ $# -gt 0 ]]; do
    case "$1" in
        --docker)       USE_DOCKER=true;   shift ;;
        --native)       USE_DOCKER=false;  shift ;;
        --build)        FORCE_BUILD=true;  shift ;;
        --dev)          DEV_MODE=true;     shift ;;
        --port)         SERVER_PORT="$2"; shift 2 ;;
        -h|--help)      show_help;         exit 0 ;;
        *) error "Unknown option: $1" ;;
    esac
done

# ---------------------------------------------------------------------------
# Helpers: read/write PID file
# ---------------------------------------------------------------------------
read_pids() {
    APP_PID=""
    SAVED_PORT=""
    if [[ -f "$PID_FILE" ]]; then
        while IFS='=' read -r key val; do
            case "$key" in
                APP_PID)     APP_PID="$val" ;;
                SERVER_PORT) SAVED_PORT="$val" ;;
            esac
        done < "$PID_FILE"
    fi
}

is_alive() { [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }

is_docker_running() {
    command -v docker &>/dev/null && docker info &>/dev/null
}

has_docker_compose() {
    [[ -f "$PROJECT_DIR/docker-compose.yml" ]]
}

ensure_logs_dir() {
    mkdir -p "$PROJECT_DIR/logs"
}

# ---------------------------------------------------------------------------
# STOP
# ---------------------------------------------------------------------------
cmd_stop() {
    banner
    hr
    echo -e "  ${BOLD}STOPPING SERVICES${NC}"
    hr
    echo ""

    local stopped=false

    if has_docker_compose && docker compose ps --status running --services 2>/dev/null | grep -q 'web'; then
        step "Stopping Docker containers"
        docker compose down 2>/dev/null || true
        step_done "Docker containers stopped"
        stopped=true
    fi

    read_pids

    if [[ -z "$APP_PID" ]]; then
        if ! $stopped; then
            warn "No services running."
            echo ""
            return 0
        fi
    fi

    if is_alive "$APP_PID"; then
        step "Stopping Node server (PID $APP_PID)"
        kill "$APP_PID" 2>/dev/null || true
        step_done "Node server stopped"
        stopped=true
    fi

    rm -f "$PID_FILE"
    echo ""
    echo -e "  ${ICON_OK}  ${COLOR}All services stopped.${NC}"
    echo ""
}

# ---------------------------------------------------------------------------
# STATUS
# ---------------------------------------------------------------------------
cmd_status() {
    banner
    hr
    echo -e "  ${BOLD}SERVICE STATUS${NC}"
    hr
    echo ""

    if has_docker_compose && docker compose ps --status running --services 2>/dev/null | grep -q 'web'; then
        echo -e "  ${ICON_OK}  ${COLOR}Docker containers running:${NC}"
        docker compose ps --status running --format "  ${ICON_OK}  {{.Service}}  ${COLOR}{{.Status}}${NC}"
        echo ""
        return 0
    fi

    read_pids
    local port="${SAVED_PORT:-$SERVER_PORT}"

    if [[ -z "$APP_PID" ]]; then
        echo -e "  ${ICON_WAIT}  ${COLOR}No services running.${NC}"
        echo ""
        return 0
    fi

    if is_alive "$APP_PID"; then
        echo -e "  ${ICON_OK}  Server       ${COLOR}RUNNING${NC}  (PID $APP_PID)  →  http://localhost:${port}"
    else
        echo -e "  ${ICON_WAIT}  Server       ${COLOR}CRASHED${NC}  (PID $APP_PID gone — check logs/server.log)"
    fi

    echo ""
}

# ---------------------------------------------------------------------------
# LOGS
# ---------------------------------------------------------------------------
cmd_logs() {
    if has_docker_compose && docker compose ps --status running --services 2>/dev/null | grep -q 'web'; then
        echo -e "  ${ICON_WAIT}  Streaming Docker container logs  (Ctrl+C to exit)..."
        echo ""
        docker compose logs -f
        return
    fi

    [[ -f "$PROJECT_DIR/logs/server.log" ]] || error "No log file found. Run './start-app.sh start' first."
    echo -e "  ${ICON_WAIT}  Streaming ${BOLD}server${NC} logs  (Ctrl+C to exit)..."
    echo ""
    tail -f "$PROJECT_DIR/logs/server.log"
}

# ---------------------------------------------------------------------------
# CLEAR
# ---------------------------------------------------------------------------
cmd_clear() {
    banner
    hr
    echo -e "  ${BOLD}CLEARING LOGS${NC}"
    hr
    echo ""

    ensure_logs_dir
    if [[ -f "$PROJECT_DIR/logs/server.log" ]]; then
        > "$PROJECT_DIR/logs/server.log"
        step_done "Cleared logs/server.log"
    else
        info "logs/server.log — not found, skipped"
    fi

    echo ""
    echo -e "  ${ICON_OK}  Log files cleared."
    echo ""
}

# ---------------------------------------------------------------------------
# BUILD (Docker only)
# ---------------------------------------------------------------------------
cmd_build() {
    banner
    hr
    echo -e "  ${BOLD}BUILDING DOCKER IMAGE${NC}"
    hr
    echo ""

    if ! is_docker_running; then
        error "Docker is not running. Please start Docker first."
    fi

    if ! has_docker_compose; then
        error "docker-compose.yml not found in repo root."
    fi

    ensure_logs_dir
    step "Building Docker image"
    if docker compose build --no-cache 2>&1 | tee "$PROJECT_DIR/logs/build.log"; then
        step_done "Docker image built successfully"
    else
        step_err "Docker build failed"
        echo -e "  ${COLOR}└─ Check logs: logs/build.log${NC}"
        exit 1
    fi

    echo ""
    echo -e "  ${ICON_OK}  ${COLOR}Build complete. Run './start-app.sh start --docker' to launch.${NC}"
    echo ""
}

# ---------------------------------------------------------------------------
# START
# ---------------------------------------------------------------------------
cmd_start() {
    banner

    if [[ "$USE_DOCKER" == true ]]; then
        cmd_start_docker
    else
        cmd_start_native
    fi
}

cmd_start_docker() {
    hr
    echo -e "  ${BOLD}DOCKER DEPLOYMENT${NC}"
    hr
    echo ""

    if ! is_docker_running; then
        error "Docker is not running. Please start Docker first."
    fi

    if ! has_docker_compose; then
        error "docker-compose.yml not found in repo root."
    fi

    ensure_logs_dir

    step "Starting Docker containers"
    if [[ "$FORCE_BUILD" == true ]]; then
        docker compose up -d --build 2>&1 | tee "$PROJECT_DIR/logs/docker.log"
    else
        docker compose up -d 2>&1 | tee "$PROJECT_DIR/logs/docker.log"
    fi
    step_done "Containers started"

    echo ""
    echo -e "  ${ICON_OK}  ${COLOR}Docker deployment complete!${NC}"
    echo -e "  ${ICON_WAIT}  Run './start-app.sh logs' to stream container logs${NC}"
    echo ""
}

cmd_start_native() {
    read_pids
    if is_alive "$APP_PID"; then
        warn "Services are already running. Run './start-app.sh stop' first."
        echo ""
        exit 1
    fi
    [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"

    hr
    echo -e "  ${BOLD}SYSTEM PREPARATION${NC}"
    hr

    if ! command -v node &>/dev/null; then
        error "Node.js not found. Please install Node.js first."
    fi

    if ! command -v npm &>/dev/null; then
        error "npm not found. Please install npm first."
    fi

    ensure_logs_dir

    step "Installing dependencies (if needed)"
    if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
        npm install
    fi
    step_done "Dependencies ready"

    echo ""
    hr
    echo -e "  ${BOLD}LAUNCHING SERVER${NC}"
    hr

    local run_script="start"
    local env_prefix="PORT=$SERVER_PORT"
    if [[ "$DEV_MODE" == true ]]; then
        run_script="dev"
        env_prefix="NODE_ENV=development PORT=$SERVER_PORT"
    fi

    step "Starting Node server (port ${SERVER_PORT})"
    bash -c "$env_prefix npm run $run_script" \
        > "$PROJECT_DIR/logs/server.log" 2>&1 &
    APP_PID=$!
    sleep 1
    if ! is_alive "$APP_PID"; then
        step_err "Server failed to start"
        echo -e "  ${COLOR}└─ Check logs: ./start-app.sh logs${NC}"
        exit 1
    fi
    disown "$APP_PID"
    step_done "Server online (PID $APP_PID)"

    {
        echo "APP_PID=${APP_PID}"
        echo "SERVER_PORT=${SERVER_PORT}"
    } > "$PID_FILE"

    echo ""
    echo -e "  ${ICON_OK}  ${COLOR}Dashboard is live at http://localhost:${SERVER_PORT}${NC}"
    echo ""
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
case "$COMMAND" in
    start)  cmd_start  ;;
    build)  cmd_build  ;;
    stop)   cmd_stop   ;;
    logs)   cmd_logs   ;;
    status) cmd_status ;;
    clear)  cmd_clear  ;;
esac
