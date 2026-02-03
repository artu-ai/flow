#!/bin/bash
set -e

# ─── Colors ───────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

info()    { echo -e "${BLUE}${BOLD}▸${RESET} $1"; }
success() { echo -e "${GREEN}${BOLD}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}${BOLD}!${RESET} $1"; }
error()   { echo -e "${RED}${BOLD}✗${RESET} $1"; }
step()    { echo -e "\n${BOLD}$1${RESET}"; }

# ─── Header ──────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}  Flow — Development Dashboard Setup${RESET}"
echo -e "${DIM}  https://github.com/artu-ai/flow${RESET}"
echo ""

# ─── 1. Check Node.js ────────────────────────────────────────────────

step "Checking prerequisites..."

if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v)
    NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
        success "Node.js $NODE_VERSION"
    else
        error "Node.js $NODE_VERSION found but v18+ is required"
        echo ""
        echo "  Update Node.js: https://nodejs.org"
        echo "  Or with nvm:    nvm install 20"
        exit 1
    fi
else
    error "Node.js is not installed"
    echo ""
    echo "  Install Node.js v18+:"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "    brew install node"
    fi
    echo "    https://nodejs.org"
    echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    exit 1
fi

if command -v npm &>/dev/null; then
    success "npm $(npm -v)"
else
    error "npm is not installed (should come with Node.js)"
    exit 1
fi

# ─── 2. Install Flow ─────────────────────────────────────────────────

step "Installing @artu-ai/flow..."

if command -v flow &>/dev/null; then
    CURRENT=$(flow --version 2>/dev/null || echo "unknown")
    info "Flow is already installed ($CURRENT), upgrading..."
fi

npm install -g @artu-ai/flow@latest 2>&1 | while IFS= read -r line; do
    echo -e "  ${DIM}$line${RESET}"
done

if command -v flow &>/dev/null; then
    success "Flow installed successfully"
else
    # npm global bin might not be in PATH
    NPM_BIN=$(npm prefix -g)/bin
    if [ -f "$NPM_BIN/flow" ]; then
        warn "Flow installed but not in PATH"
        echo ""
        echo "  Add to your shell profile (~/.zshrc or ~/.bashrc):"
        echo ""
        echo "    export PATH=\"$NPM_BIN:\$PATH\""
        echo ""
    else
        error "Installation failed"
        exit 1
    fi
fi

# ─── 3. Tailscale (optional) ─────────────────────────────────────────

step "Checking optional dependencies..."

if command -v tailscale &>/dev/null; then
    success "Tailscale installed (for remote access via \`flow expose\`)"
else
    warn "Tailscale not found (optional — needed for \`flow expose\`)"
    echo ""

    INSTALL_TS="n"
    # Only prompt if running interactively
    if [ -t 0 ]; then
        echo -ne "  Install Tailscale? ${DIM}(y/N)${RESET} "
        read -r INSTALL_TS
    fi

    if [[ "$INSTALL_TS" =~ ^[Yy]$ ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &>/dev/null; then
                info "Installing Tailscale via Homebrew..."
                brew install --cask tailscale 2>&1 | while IFS= read -r line; do
                    echo -e "  ${DIM}$line${RESET}"
                done
                success "Tailscale installed"
                echo ""
                info "Open Tailscale.app to sign in and connect"
            else
                warn "Homebrew not found. Install Tailscale manually:"
                echo "  https://tailscale.com/download/mac"
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            info "Installing Tailscale..."
            curl -fsSL https://tailscale.com/install.sh | sh 2>&1 | while IFS= read -r line; do
                echo -e "  ${DIM}$line${RESET}"
            done
            success "Tailscale installed"
            echo ""
            info "Run: sudo tailscale up"
        else
            warn "Install Tailscale manually: https://tailscale.com/download"
        fi
    else
        echo -e "  ${DIM}Skip. You can install later: https://tailscale.com/download${RESET}"
    fi
fi

# ─── 4. Setup ~/.flow directory ──────────────────────────────────────

step "Setting up config..."

FLOW_DIR="$HOME/.flow"
CONFIG_FILE="$FLOW_DIR/config.json"

mkdir -p "$FLOW_DIR"

if [ -f "$CONFIG_FILE" ]; then
    success "Config exists at $CONFIG_FILE"
else
    cat > "$CONFIG_FILE" << 'EOF'
{
  "linear": {
    "apiKey": null
  },
  "completion": {
    "activeProvider": null,
    "ollama": { "url": "http://localhost:11434", "model": "" },
    "claude": { "apiKey": "", "model": "claude-3-5-haiku-20241022" }
  }
}
EOF
    success "Created config at $CONFIG_FILE"
fi

# ─── Done ─────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}${BOLD}  Setup complete!${RESET}"
echo ""
echo -e "  ${BOLD}Get started:${RESET}"
echo ""
echo -e "    ${BOLD}flow open${RESET}          Open dashboard for current project"
echo -e "    ${BOLD}flow list${RESET}          List running dashboards"
echo -e "    ${BOLD}flow stop${RESET}          Stop current project's dashboard"
echo -e "    ${BOLD}flow expose${RESET}        Share via Tailscale (remote access)"
echo ""
echo -e "  ${DIM}Configure Linear and AI completions in the dashboard settings.${RESET}"
echo ""
