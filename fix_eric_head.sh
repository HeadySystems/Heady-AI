#!/bin/bash
set -e

# Replace "Eric Head" with "Eric Haywood"
find . -type f \( -name "*.md" -o -name "*.js" -o -name "*.py" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -exec grep -l "Eric Head" {} + | xargs -r sed -i 's/Eric Head/Eric Haywood/g'
