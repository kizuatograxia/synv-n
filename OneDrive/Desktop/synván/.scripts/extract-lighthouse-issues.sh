#!/bin/bash
cat "$1" | jq '.audits | to_entries[] | select(.value.score != null and .value.score < 1) | {id: .key, title: .value.title, score: .value.score}'
