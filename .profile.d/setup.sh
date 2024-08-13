#!/bin/bash

# Make scripts executable
chmod +x /app/tunnel.sh
chmod +x /app/profile.d/odbc_setup.sh

# Run ODBC setup
source /app/profile.d/odbc_setup.sh

# Start the SSH tunnel
/app/tunnel.sh

# Start your Node.js application
npm start