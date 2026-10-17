#!/bin/sh
set -eu

target_dir=/p17-ca

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] ||
  fail P17_DB_CA_INIT_UID_INVALID

[ -d "$target_dir" ] ||
  fail P17_DB_CA_INIT_DIRECTORY_MISSING

if [ "$(stat -c '%u:%g:%a' "$target_dir")" = "999:999:750" ]; then
  # This service intentionally retains only CAP_CHOWN. After the first run it cannot traverse the
  # 0750 directory owned by 999:999, so the following exporter (running as 999:999) owns the file
  # inventory, certificate validation and atomic replacement checks.
  printf '%s\n' P17_DB_CA_VOLUME_ALREADY_INITIALIZED_PASS
  exit 0
fi

[ "$(stat -c '%u:%g' "$target_dir")" = "0:0" ] ||
  fail P17_DB_CA_INIT_OWNERSHIP_UNEXPECTED

[ -z "$(find "$target_dir" -mindepth 1 -maxdepth 1 -print -quit)" ] ||
  fail P17_DB_CA_INIT_DIRECTORY_NOT_EMPTY

chmod 0750 "$target_dir"
chown 999:999 "$target_dir"

[ "$(stat -c '%u:%g:%a' "$target_dir")" = "999:999:750" ] ||
  fail P17_DB_CA_INIT_POSTCONDITION_FAILED

printf '%s\n' P17_DB_CA_VOLUME_INIT_PASS
