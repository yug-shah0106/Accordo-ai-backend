#!/bin/bash
cd "$(dirname "$0")"
exec node --loader ts-node/esm src/index.ts
