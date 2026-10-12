#!/bin/sh
set -eu

source_ca=/var/lib/mysql/ca.pem
target_dir=/p17-ca
target_tmp="$target_dir/.ca.pem.tmp"
target_ca="$target_dir/ca.pem"

umask 027

attempt=0
while [ "$attempt" -lt 240 ]; do
  if [ -f "$source_ca" ] && [ -r "$source_ca" ]; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 0.25
done

[ -f "$source_ca" ] && [ -r "$source_ca" ] || {
  printf '%s\n' P17_DB_CA_EXPORT_SOURCE_UNAVAILABLE >&2
  exit 1
}

grep -F -- '-----BEGIN CERTIFICATE-----' "$source_ca" >/dev/null || {
  printf '%s\n' P17_DB_CA_EXPORT_CERTIFICATE_INVALID >&2
  exit 1
}

if grep -F -- 'PRIVATE KEY' "$source_ca" >/dev/null; then
  printf '%s\n' P17_DB_CA_EXPORT_PRIVATE_KEY_FORBIDDEN >&2
  exit 1
fi

install -m 0440 "$source_ca" "$target_tmp"
mv -f "$target_tmp" "$target_ca"

[ "$(find "$target_dir" -mindepth 1 -maxdepth 1 -type f -printf '%f\n')" = 'ca.pem' ] || {
  printf '%s\n' P17_DB_CA_EXPORT_OUTPUT_INVENTORY_INVALID >&2
  exit 1
}

printf '%s\n' P17_DB_CA_EXPORT_PASS
