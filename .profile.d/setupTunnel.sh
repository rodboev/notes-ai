#!/bin/bash
echo "Starting setup.sh script"

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."

# Quick environment variable check
echo "Verifying environment variables:"
for var in SSH_TUNNEL_FORWARD SSH_TUNNEL_PORT SSH_TUNNEL_TARGET PRIVATE_SSH_KEY; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in Heroku config"
        exit 1
    else
        if [[ "$var" == *"KEY"* ]]; then
            echo "✅ $var is set (value hidden)"
        else
            echo "✅ $var=${!var}"
        fi
    fi
done

# Create SSH directory and set permissions
mkdir -p /app/.ssh
chmod 700 /app/.ssh

# Write SSH key with proper format
echo "Writing SSH key..."
echo "$PRIVATE_SSH_KEY" | sed 's/^"\(.*\)"$/\1/' | sed 's/\\n/\n/g' > /app/.ssh/id_rsa
chmod 600 /app/.ssh/id_rsa

# Verify SSH key format and content
echo "Verifying SSH key:"
if ! grep -q "BEGIN OPENSSH PRIVATE KEY" /app/.ssh/id_rsa; then
    echo "❌ SSH key missing BEGIN marker"
    echo "First 3 lines of key:"
    head -n 3 /app/.ssh/id_rsa
    exit 1
fi

echo "First 3 lines of processed key:"
head -n 3 /app/.ssh/id_rsa

# Test SSH connection before starting tunnel
echo "Testing SSH connection..."
ssh -v -i /app/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -p $SSH_TUNNEL_PORT \
    $SSH_TUNNEL_TARGET echo "Test connection" > /tmp/ssh_test.log 2>&1

if [ $? -ne 0 ]; then
    echo "❌ SSH test connection failed:"
    cat /tmp/ssh_test.log
    exit 1
fi
echo "✅ SSH test connection successful"

# Create tunnel script
cat << 'EOF' > /app/ssh_tunnel.sh
#!/bin/bash

function start_tunnel() {
    echo "$(date): Starting SSH tunnel..."
    
    # Start tunnel with verbose logging
    ssh -v -N -L $SSH_TUNNEL_FORWARD \
        -i /app/.ssh/id_rsa \
        -o StrictHostKeyChecking=no \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes \
        -p $SSH_TUNNEL_PORT \
        $SSH_TUNNEL_TARGET > /tmp/ssh_tunnel.log 2>&1 &
    
    TUNNEL_PID=$!
    echo $TUNNEL_PID > /tmp/tunnel.pid
    
    # Wait for tunnel to establish
    sleep 5
    
    # Verify tunnel is listening
    if netstat -an | grep "LISTEN" | grep -q ":1433 "; then
        echo "✅ Port 1433 is listening"
        return 0
    else
        echo "❌ Port 1433 is not listening"
        cat /tmp/ssh_tunnel.log
        return 1
    fi
}

# Kill any existing tunnel
if [ -f /tmp/tunnel.pid ]; then
    kill $(cat /tmp/tunnel.pid) 2>/dev/null || true
fi

# Start tunnel with retries
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

# Monitor tunnel and restart if it fails
while true; do
    if ! netstat -an | grep "LISTEN" | grep -q ":1433 "; then
        echo "$(date): Tunnel down, restarting..."
        start_tunnel
    fi
    sleep 30
done
EOF

chmod +x /app/ssh_tunnel.sh

# Start the tunnel script with PM2
echo "Starting tunnel with PM2..."
pm2 delete ssh-tunnel 2>/dev/null || true
pm2 start /app/ssh_tunnel.sh \
    --name "ssh-tunnel" \
    --time \
    --no-autorestart \
    --max-restarts 1000

# Save PM2 configuration
pm2 save

echo "Waiting for tunnel to establish..."
sleep 10

# Final verification
echo "Verifying tunnel status:"
if netstat -an | grep "LISTEN" | grep -q ":1433 "; then
    echo "✅ Port 1433 is listening"
else
    echo "❌ Port 1433 is not listening"
    echo "PM2 logs:"
    pm2 logs ssh-tunnel --lines 50
    exit 1
fi

echo "setup.sh script completed"
