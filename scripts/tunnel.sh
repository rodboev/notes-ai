#!/bin/bash

# Create .ssh directory
mkdir -p /app/.ssh
chmod 700 /app/.ssh

# Decode the private key from the environment variable into a file
echo "$SSH_PRIVATE_KEY" > /app/.ssh/id_rsa
chmod 600 /app/.ssh/id_rsa

# Start the SSH tunnel
ssh -N -L 1433:172.19.1.71:1433 -i /app/.ssh/id_rsa -o StrictHostKeyChecking=no -p 1022 alex@70.19.53.6 &
