#!/bin/bash

# Create user local configurations
mkdir -p $HOME/.odbc

# Create .odbcinst.ini in user space
cat <<EOL > $HOME/.odbcinst.ini
[ODBC Drivers]
ODBC Driver 17 for SQL Server=Installed

[ODBC Driver 17 for SQL Server]
Description=Microsoft ODBC Driver 17 for SQL Server
Driver=/usr/lib/x86_64-linux-gnu/odbc/libmsodbcsql-17.so
EOL

# Create .odbc.ini in user space
cat <<EOL > $HOME/.odbc.ini
[DSN]
Description=My DSN
Driver=ODBC Driver 17 for SQL Server
Server=${SQL_SERVER},${SQL_PORT}
Database=${SQL_DATABASE}
Trace=No
EOL
