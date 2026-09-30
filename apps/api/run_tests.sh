#!/bin/bash

# Run the adjacent test runner regardless of the caller's working directory.
exec python3 "$(dirname "$0")/run_tests.py" "$@"
