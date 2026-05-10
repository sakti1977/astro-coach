#!/bin/bash
# Astro Coach — start both services

echo "✦ Starting Astro Coach..."

# Start Python ephemeris service
echo "→ Starting ephemeris service on :8000"
cd python-service
uvicorn main:app --port 8000 --reload &
PYTHON_PID=$!
cd ..

# Wait for Python service
sleep 2

# Start Next.js dev server
echo "→ Starting Next.js on :3000"
cd astro-coach
npm run dev &
NEXT_PID=$!
cd ..

echo ""
echo "✦ Astro Coach is running:"
echo "  App:              http://localhost:3000"
echo "  Ephemeris API:    http://localhost:8000"
echo "  API docs:         http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both services."

trap "kill $PYTHON_PID $NEXT_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
