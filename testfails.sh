#!/bin/bash

set -e

fails=$(grep FAIL testoutput | wc -l)

if [[ $fails == "0" ]]; then
    echo "no fails"
    exit 0
else
    echo "fails"
    exit 1
fi

