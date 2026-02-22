#!/bin/bash
jq '.audits | to_entries[] | select(.value.score != null and .value.score < 1 and (.key | startswith("aria-") or .key | startswith("color-") or .key == "label" or .key == "image-alt" or .key == "link-name" or .key == "button-name" or .key == "listitem")) | {id: .key, title: .value.title, score: .value.score}' "$1" | jq -s '.'
