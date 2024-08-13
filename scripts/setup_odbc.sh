#!/bin/bash

# Create .odbcinst.ini
mkdir -p $HOME/.odbc
cat <<EOL > $HOME/.odbcinst.ini
[ODBC Drivers]
TDS=Installed

[TDS]
Description=TDS driver (MS SQL)
Driver=/usr/lib/x86_64-linux-gnu/odbc/libtdsodbc.so
Setup=/usr/lib/x86_64-linux-gnu/odbc/libtdsS.so
FileUsage=1
EOL

# Create .odbc.ini
cat <<EOL > $HOME/.odbc.ini
[DSN]
Description=FreeTDS ODBC Driver for SQL Server
Driver=TDS
Server=${SQL_SERVER}
Port=${SQL_PORT}
Database=${SQL_DATABASE}
Trace=No
EOL
