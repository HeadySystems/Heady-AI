# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
set -e
echo "🔐 [Heady-Pipeline] Bootstrapping mTLS Certificate Authority..."

CERT_DIR="../data/mtls"
mkdir -p $CERT_DIR
cd $CERT_DIR

# 1. Generate Root CA
echo "Generating Root CA..."
openssl genrsa -out heady-root-ca.key 4096
openssl req -x509 -new -nodes -key heady-root-ca.key -sha256 -days 3650 -out heady-root-ca.crt -subj "/C=US/ST=CA/O=HeadySystems Inc/CN=HeadySystems Root CA"

# 2. Generate Conductor Cert
echo "Generating Conductor Cert..."
openssl genrsa -out conductor.key 2048
openssl req -new -key conductor.key -out conductor.csr -subj "/C=US/ST=CA/O=HeadySystems Inc/CN=heady-conductor"
openssl x509 -req -in conductor.csr -CA heady-root-ca.crt -CAkey heady-root-ca.key -CAcreateserial -out conductor.crt -days 365 -sha256

# 3. Generate Edge Node Cert
echo "Generating Edge Node Cert..."
openssl genrsa -out edge.key 2048
openssl req -new -key edge.key -out edge.csr -subj "/C=US/ST=CA/O=HeadySystems Inc/CN=heady-edge"
openssl x509 -req -in edge.csr -CA heady-root-ca.crt -CAkey heady-root-ca.key -CAcreateserial -out edge.crt -days 365 -sha256

echo "✅ mTLS Bootstrap Complete. Deploy these to respective nodes."
