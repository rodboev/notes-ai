#!/bin/bash
echo "Starting setup.sh script"

# ODBC and FreeTDS Setup
export ODBCSYSINI=/app/.apt/etc
export ODBCINI=/app/.apt/etc/odbc.ini
export FREETDSCONF=/app/.apt/etc/freetds/freetds.conf
export LD_LIBRARY_PATH=/app/.apt/usr/lib/x86_64-linux-gnu:/app/.apt/usr/lib/x86_64-linux-gnu/odbc:$LD_LIBRARY_PATH

mkdir -p /app/.apt/etc/freetds
echo "[global]
tds version = 7.4
" > /app/.apt/etc/freetds/freetds.conf

mkdir -p $ODBCSYSINI
cat > "$ODBCSYSINI/odbcinst.ini" << EOL
[FreeTDS]
Description = FreeTDS Driver
Driver = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup = /app/.apt/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
EOL

cat > "$ODBCINI" << EOL
[MSSQL]
Driver = FreeTDS
Server = 127.0.0.1
Port = 1433
Database = ${SQL_DATABASE}
EOL

# Add FreeTDS bin to PATH
export PATH=$PATH:/app/.apt/usr/bin

# SSH Tunnel Setup
echo "Setting up SSH tunnel..."
mkdir -p /app/.ssh
chmod 700 /app/.ssh
echo "$SSH_PRIVATE_KEY" > /app/.ssh/id_rsa
chmod 600 /app/.ssh/id_rsa

# Start the SSH tunnel in the background
ssh -N -L 1433:172.19.1.71:1433 -i /app/.ssh/id_rsa -o StrictHostKeyChecking=no -p 1022 $SSH_TUNNEL_TARGET &
if [ $? -ne 0 ]; then
    echo "Tunnel setup failed!"
    exit 1
fi

echo "Tunnel setup successful."
echo "setup.sh script completed"