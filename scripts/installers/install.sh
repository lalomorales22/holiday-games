#!/usr/bin/env bash
set -euo pipefail
umask 077

source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
install_dir=${HOLIDAY_INSTALL_DIR:-"$HOME/.holiday-arcade"}
if [[ "$install_dir" != /* ]]; then install_dir="$PWD/$install_dir"; fi
export HOLIDAY_INSTALL_DIR="$install_dir"
no_start=0
if [ "${1:-}" = "--no-start" ]; then no_start=1; shift; fi
if [ "$#" -ne 0 ]; then printf 'Usage: bash Install-Linux.sh [--no-start]\n'; exit 1; fi

valid_node() {
  "$1" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=12)?0:1)' >/dev/null 2>&1
}
node_path=""
if command -v node >/dev/null 2>&1 && valid_node "$(command -v node)"; then
  node_path=$(command -v node)
elif [ -x "$install_dir/runtime/bin/node" ] && valid_node "$install_dir/runtime/bin/node"; then
  node_path="$install_dir/runtime/bin/node"
fi

if [ -z "$node_path" ]; then
  case "$(uname -s)" in
    Darwin) platform=darwin ;;
    Linux) platform=linux ;;
    *) printf 'This installer supports macOS and Linux. On Windows, use Install-Windows.cmd.\n'; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) architecture=x64 ;;
    arm64|aarch64) architecture=arm64 ;;
    *) printf 'Automatic Node installation supports x64 and ARM64 computers. Install Node.js 22.12+ manually on this architecture.\n'; exit 1 ;;
  esac
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    printf 'Install curl or wget, then run this installer again.\n'; exit 1
  fi
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    printf 'A SHA-256 tool (sha256sum or shasum) is needed to verify Node.js.\n'; exit 1
  fi
  # Only claim an empty folder, or one already owned by this installer.
  mkdir -p -- "$install_dir"
  if [ -f "$install_dir/.holiday-arcade-install" ]; then
    if [ "$(cat "$install_dir/.holiday-arcade-install")" != 'Holiday Arcade installer v1' ]; then
      printf 'This installation folder has an unknown owner. Choose an empty HOLIDAY_INSTALL_DIR.\n'; exit 1
    fi
  elif [ -n "$(ls -A -- "$install_dir")" ]; then
    printf 'The installation folder is not empty. Choose an empty HOLIDAY_INSTALL_DIR.\n'; exit 1
  else
    printf 'Holiday Arcade installer v1\n' > "$install_dir/.holiday-arcade-install"
  fi
  printf 'Downloading a private Node.js 24 LTS runtime from nodejs.org. No administrator access needed.\n'
  scratch_dir=$(mktemp -d "${TMPDIR:-/tmp}/holiday-arcade-node.XXXXXXXX")
  trap 'rm -rf -- "$scratch_dir"' EXIT
  download() {
    if command -v curl >/dev/null 2>&1; then
      curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 --retry 3 --connect-timeout 15 --max-time 300 "$1" --output "$2"
    else
      wget --https-only --timeout=30 --tries=3 --quiet "$1" --output-document="$2"
    fi
  }
  download https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt "$scratch_dir/checksums"
  checksum_line=$(awk -v suffix="-$platform-$architecture.tar.gz" '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-/ && substr($2,length($2)-length(suffix)+1)==suffix {print; exit}' "$scratch_dir/checksums")
  if [ -z "$checksum_line" ]; then printf 'No matching Node.js runtime was found. Try again or install Node.js manually.\n'; exit 1; fi
  expected_hash=${checksum_line%% *}
  archive_name=${checksum_line##* }
  node_version=${archive_name%-"$platform"-"$architecture".tar.gz}
  node_version=${node_version#node-}
  # Use the exact version URL so a moving latest release cannot change the archive mid-install.
  download "https://nodejs.org/dist/$node_version/$archive_name" "$scratch_dir/node.tar.gz"
  if command -v sha256sum >/dev/null 2>&1; then
    actual_hash=$(sha256sum "$scratch_dir/node.tar.gz"); actual_hash=${actual_hash%% *}
  else
    actual_hash=$(shasum -a 256 "$scratch_dir/node.tar.gz"); actual_hash=${actual_hash%% *}
  fi
  if [ "$actual_hash" != "$expected_hash" ]; then printf 'Node.js checksum verification failed. Nothing was activated.\n'; exit 1; fi
  mkdir "$scratch_dir/runtime"
  tar -xzf "$scratch_dir/node.tar.gz" --strip-components=1 -C "$scratch_dir/runtime"
  if ! valid_node "$scratch_dir/runtime/bin/node"; then printf 'The downloaded runtime cannot run on this computer. Install a supported Node.js 22.12+ runtime manually.\n'; exit 1; fi
  if [ -e "$install_dir/runtime" ]; then printf 'The existing private runtime needs repair. Move its runtime folder aside and try again.\n'; exit 1; fi
  mv -- "$scratch_dir/runtime" "$install_dir/runtime"
  node_path="$install_dir/runtime/bin/node"
fi

"$node_path" "$source_dir/scripts/install.js"
if [ "$no_start" -eq 0 ]; then
  exec "$node_path" "$install_dir/app/scripts/run-installed.js" "$install_dir"
fi
