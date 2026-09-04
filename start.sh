#!/bin/sh
set -e

# Render nginx config, substituting only BACKEND_UPSTREAM so nginx's own
# variables ($host, $uri, ...) pass through untouched.
export BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://backend:8080}"
envsubst '$BACKEND_UPSTREAM' < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Generate runtime configuration for frontend
cat <<EOF > /usr/share/nginx/html/config.js
window.APP_CONFIG = {
  apiBaseUrl: "${API_BASE_URL:-}"
};
EOF

# Start nginx with exec so signals propagate properly
exec nginx -g "daemon off;"
