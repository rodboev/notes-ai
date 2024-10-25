#!/bin/bash
echo "Starting setup.sh script"

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."

# Create SSH directory and set permissions
mkdir -p /app/.ssh
chmod 700 /app/.ssh

# Write SSH key without quotes and with proper newlines
printf "%s" "$PRIVATE_SSH_KEY" | sed 's/\\n/\n/g' > /app/.ssh/id_rsa
chmod 600 /app/.ssh/id_rsa

# Verify SSH key was written correctly
if [ ! -s /app/.ssh/id_rsa ]; then
    echo "Error: SSH key file is empty"
    cat /app/.ssh/id_rsa
    exit 1
fi

# Create a tunnel script with explicit SSH options
cat << 'EOF' > /app/ssh_tunnel.sh
#!/bin/bash

function start_tunnel() {
    echo "$(date): Starting SSH tunnel..."
    
    # Test SSH connection first with verbose output
    ssh -v -i /app/.ssh/id_rsa \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o KexAlgorithms=curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group14-sha1 \
        -o Ciphers=chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr \
        -o MACs=hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com \
        -o Protocol=2 \
        -o ConnectTimeout=10 \
        -p $SSH_TUNNEL_PORT \
        $SSH_TUNNEL_TARGET echo "Test connection" > /tmp/ssh_test.log 2>&1

    if [ $? -ne 0 ]; then
        echo "SSH test connection failed:"
        cat /tmp/ssh_test.log
        return 1
    fi

    # Start the actual tunnel with the same options
    ssh -v -N -L $SSH_TUNNEL_FORWARD \
        -i /app/.ssh/id_rsa \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o KexAlgorithms=curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group14-sha1 \
        -o Ciphers=chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr \
        -o MACs=hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com \
        -o Protocol=2 \
        -o ConnectTimeout=10 \
        -p $SSH_TUNNEL_PORT \
        $SSH_TUNNEL_TARGET > /tmp/ssh_tunnel.log 2>&1 &
    
    TUNNEL_PID=$!
    echo $TUNNEL_PID > /tmp/tunnel.pid
    
    # Wait for tunnel to establish
    sleep 5
    
    if kill -0 $TUNNEL_PID 2>/dev/null; then
        echo "$(date): Tunnel established successfully (PID: $TUNNEL_PID)"
        return 0
    else
        echo "$(date): Tunnel failed to establish"
        cat /tmp/ssh_tunnel.log
        return 1
    fi
}

# Kill any existing tunnel
if [ -f /tmp/tunnel.pid ]; then
    kill $(cat /tmp/tunnel.pid) 2>/dev/null || true
fi

# Start the tunnel with retries
max_retries=3
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    start_tunnel
    if [ $? -eq 0 ]; then
        break
    fi
    retry_count=$((retry_count + 1))
    echo "Tunnel start failed, attempt $retry_count of $max_retries"
    sleep 5
done

# Sleep for 30 minutes then exit (PM2 will restart the script)
sleep 1800
echo "$(date): 30-minute timeout reached, exiting for restart"
kill $(cat /tmp/tunnel.pid) 2>/dev/null || true
EOF

chmod +x /app/ssh_tunnel.sh

# Start the tunnel script with PM2
echo "Starting tunnel with PM2..."
pm2 delete ssh-tunnel 2>/dev/null || true
pm2 start /app/ssh_tunnel.sh \
    --name "ssh-tunnel" \
    --time \
    --cron "*/30 * * * *" \
    --no-autorestart \
    --max-restarts 1000

# Save PM2 configuration
pm2 save

echo "Waiting for tunnel to establish..."
sleep 10

# Verify tunnel is running
if pm2 show ssh-tunnel | grep -q "online"; then
    echo "Tunnel setup successful"
else
    echo "Tunnel setup failed. Check logs with: pm2 logs ssh-tunnel"
    pm2 logs ssh-tunnel --lines 50
fi

echo "setup.sh script completed"
