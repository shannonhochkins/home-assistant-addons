#!/usr/bin/with-contenv bashio

set +u

export PORT=$(bashio::addon.port 8080)
export OPTIONS="./data/options.json"

bashio::log.info "Starting http service on port $PORT."

exec npm run start;