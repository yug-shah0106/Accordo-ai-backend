#!/bin/bash

# Kill any existing nodemon processes
echo "Stopping existing nodemon processes..."
pkill -f "nodemon" || true

# Wait a moment for processes to terminate
sleep 1

# Verify no nodemon processes are running
if pgrep -f "nodemon" > /dev/null; then
    echo "Warning: Some nodemon processes may still be running"
    echo "Please manually kill them with: pkill -9 -f nodemon"
else
    echo "All nodemon processes stopped successfully"
fi

# Start nodemon
echo "Starting nodemon..."
nodemon --config nodemon.json




