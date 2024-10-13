#!/bin/bash
bash scripts/setupTunnel.sh > tunnel.log 2>&1 &
echo "Tunnel setup initiated in background. Check tunnel.log for details."

