#!/bin/bash

echo "🚀 Deploying All Heady Installable Packages..."
echo "============================================"

# Deploy HeadyBuddy
echo "🤖 Deploying HeadyBuddy..."
cd /home/headyme/INSTALLABLE_PACKAGES/HeadyBuddy
python3 -m http.server 8080 &
BUDDY_PID=$!

# Deploy HeadyAI-IDE
echo "💻 Deploying HeadyAI-IDE..."
cd /home/headyme/INSTALLABLE_PACKAGES/HeadyAI-IDE
python3 -m http.server 8081 &
IDE_PID=$!

# Deploy HeadyWeb
echo "🌐 Deploying HeadyWeb..."
cd /home/headyme/INSTALLABLE_PACKAGES/HeadyWeb
python3 -m http.server 8082 &
WEB_PID=$!

echo "✅ All packages deployed!"
echo "🌐 Access URLs:"
echo "   HeadyBuddy: http://localhost:8080"
echo "   HeadyAI-IDE: http://localhost:8081"
echo "   HeadyWeb: http://localhost:8082"

echo "🎯 Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo '🛑 Stopping all services...'; kill $BUDDY_PID $IDE_PID $WEB_PID 2>/dev/null; exit" INT

wait
