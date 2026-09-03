#!/bin/sh
set -e

# Generate runtime configuration for frontend
cat <<EOF > /usr/share/nginx/html/config.js
window.APP_CONFIG = {
  apiBaseUrl: "${API_BASE_URL:-}"
};
EOF

# Start nginx with exec so signals propagate properly
exec nginx -g "daemon off;"

