#!/bin/sh

# Setting up ODBC environment variables
export ODBCINI=$HOME/.odbc.ini
export ODBCSYSINI=$HOME

# Ensure configuration directory exists
mkdir -p $HOME

# Define the ODBC data source in .odbc.ini
cat <<EOT > $HOME/.odbc.ini
[ODBC Data Sources]
SQLServer=ODBC Driver 17 for SQL Server

[SQLServer]
Driver=ODBC Driver 17 for SQL Server
Server=${SQL_SERVER},${SQL_PORT}
Database=${SQL_DATABASE}
User=${SQL_USERNAME}
Password=${SQL_PASSWORD}
Encrypt=yes
TrustServerCertificate=yes

EOT

# Define the ODBC driver in odbcinst.ini
cat <<EOT > $HOME/odbcinst.ini
[ODBC Driver 17 for SQL Server]
Description=Microsoft ODBC Driver 17 for SQL Server
Driver=/app/.apt/usr/lib/libmsodbcsql-17.5.so.2.1

EOT
