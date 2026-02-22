#!/bin/bash
cat "$1" | jq ".audits.$2"
