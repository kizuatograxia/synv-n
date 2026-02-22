#!/bin/bash
jq '.audits["$1"]' "$2"
