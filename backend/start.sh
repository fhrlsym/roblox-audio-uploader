#!/bin/sh

# Keep the PO Token provider local to the backend container.
cd /opt/bgutil/server
node build/main.js --port 4416 &

cd /app
exec node index.js
