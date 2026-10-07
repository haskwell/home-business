#!/usr/bin/env bash
set -euo pipefail

BUCKET="home-business-dev"
API_BASE="https://api.cloudflare.com/client/v4"

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  printf 'Set CLOUDFLARE_ACCOUNT_ID before running this script.\n' >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  printf 'Set CLOUDFLARE_API_TOKEN before running this script.\n' >&2
  exit 1
fi

for command in curl jq base64; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command not found: %s\n' "$command" >&2
    exit 1
  fi
done

printf 'This will permanently delete every object from the REMOTE R2 bucket "%s".\n' "$BUCKET"
read -r -p "Type the bucket name to continue: " confirmation
if [[ "$confirmation" != "$BUCKET" ]]; then
  printf 'Confirmation did not match. Nothing was changed.\n' >&2
  exit 1
fi

cursor=""
deleted_count=0

while :; do
  list_args=(
    --get
    --data-urlencode 'per_page=1000'
  )
  if [[ -n "$cursor" ]]; then
    list_args+=(--data-urlencode "cursor=$cursor")
  fi

  response="$(curl --fail --silent --show-error "${list_args[@]}" \
    "$API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$BUCKET/objects" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")"

  if [[ "$(jq -r '.success' <<<"$response")" != "true" ]]; then
    printf 'Cloudflare failed to list objects in bucket "%s".\n' "$BUCKET" >&2
    jq -r '.errors[]?.message // empty' <<<"$response" >&2
    exit 1
  fi

  object_keys="$(jq -r '.result[]?.key | @base64' <<<"$response")"
  if [[ -n "$object_keys" ]]; then
    while IFS= read -r encoded_key; do
      key="$(base64 --decode <<<"$encoded_key")"
      encoded_path="$(jq -rn --arg key "$key" '$key | @uri')"
      delete_response="$(curl --fail --silent --show-error --request DELETE \
        "$API_BASE/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$BUCKET/objects/$encoded_path" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")"

      if [[ "$(jq -r '.success' <<<"$delete_response")" != "true" ]]; then
        printf 'Cloudflare failed to delete an object from bucket "%s".\n' "$BUCKET" >&2
        jq -r '.errors[]?.message // empty' <<<"$delete_response" >&2
        exit 1
      fi

      deleted_count=$((deleted_count + 1))
    done <<<"$object_keys"
  fi

  is_truncated="$(jq -r '.result_info.is_truncated // false' <<<"$response")"
  if [[ "$is_truncated" != "true" ]]; then
    break
  fi

  cursor="$(jq -r '.result_info.cursor // empty' <<<"$response")"
  if [[ -z "$cursor" ]]; then
    printf 'Cloudflare returned a truncated object list without a cursor. Stopping.\n' >&2
    exit 1
  fi
done

printf 'Deleted %s object(s) from the remote R2 bucket "%s".\n' "$deleted_count" "$BUCKET"
