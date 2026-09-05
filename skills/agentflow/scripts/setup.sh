#!/bin/sh
set -eu
skill_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_path=''
revision=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --node) node_path=$2; shift 2 ;;
    --revision) revision=$2; shift 2 ;;
    *) echo "Unknown setup argument: $1" >&2; exit 1 ;;
  esac
done
compatible() {
  [ -n "$1" ] && [ -x "$1" ] && "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(process.versions.electron||a<22||a===22&&b<13?1:0)' >/dev/null 2>&1
}
if [ -n "$node_path" ]; then
  compatible "$node_path" || { echo 'The supplied Node executable must be Node.js 22.13+.' >&2; exit 1; }
else
  node_path=$(command -v node || true)
fi
download() {
  if command -v curl >/dev/null 2>&1; then curl --fail --location --silent --show-error --connect-timeout 10 --max-time 120 "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -q --timeout=120 "$1" -O "$2"
  else echo 'Setup needs curl or wget to download the official Node runtime.' >&2; exit 1; fi
}
if ! compatible "$node_path"; then
  case $(uname -s) in Darwin) platform=darwin ;; Linux) platform=linux ;; *) echo 'Unsupported operating system.' >&2; exit 1 ;; esac
  case $(uname -m) in x86_64) arch=x64 ;; arm64|aarch64) arch=arm64 ;; *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;; esac
  cache_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}/agentflow/runtimes/node
  mkdir -p "$cache_dir"
  temporary=$(mktemp -d "$cache_dir/.download-XXXXXXXX")
  trap 'rm -rf -- "$temporary"' EXIT HUP INT TERM
  download 'https://nodejs.org/download/release/latest-v24.x/SHASUMS256.txt' "$temporary/checksums"
  entry=$(grep -E "^[a-f0-9]{64}  node-v24\.[0-9]+\.[0-9]+-$platform-$arch\.tar\.gz$" "$temporary/checksums")
  [ "$(printf '%s\n' "$entry" | wc -l | tr -d ' ')" = 1 ] || { echo 'Could not resolve the official Node archive.' >&2; exit 1; }
  expected=${entry%% *}
  archive=${entry##* }
  version=${archive#node-}; version=${version%-$platform-$arch.tar.gz}
  destination=$cache_dir/$version-$platform-$arch
  node_path=$destination/bin/node
  if ! compatible "$node_path"; then
    [ ! -e "$destination" ] || { echo "Unusable runtime directory: $destination" >&2; exit 1; }
    echo "Preparing a private Node runtime: $version ($platform-$arch)"
    download "https://nodejs.org/download/release/$version/$archive" "$temporary/$archive"
    if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$temporary/$archive"); else actual=$(shasum -a 256 "$temporary/$archive"); fi
    [ "${actual%% *}" = "$expected" ] || { echo 'Node archive checksum mismatch.' >&2; exit 1; }
    tar -xzf "$temporary/$archive" -C "$temporary"
    compatible "$temporary/node-$version-$platform-$arch/bin/node" || { echo 'Downloaded Node could not run on this computer.' >&2; exit 1; }
    mv -- "$temporary/node-$version-$platform-$arch" "$destination"
  fi
fi
if [ -n "$revision" ]; then "$node_path" "$skill_dir/scripts/agentflow.mjs" skill setup --revision "$revision"
else "$node_path" "$skill_dir/scripts/agentflow.mjs" skill setup; fi
"$node_path" "$skill_dir/scripts/agentflow.mjs" host validate "$skill_dir/assets/review-flow.json"
