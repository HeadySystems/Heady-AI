import re

with open('docker-compose.yml', 'r') as f:
    lines = f.readlines()

new_lines = []
inserted = False

for line in lines:
    if line.startswith('volumes:') and not inserted:
        # We need to backtrack and insert our block right before 'volumes:'
        new_lines.extend([
            "  auth-session-server:\n",
            "    build:\n",
            "      context: ./services/auth-session-server\n",
            "      dockerfile: Dockerfile\n",
            "    environment:\n",
            "      PORT: 4309\n",
            "      NODE_ENV: production\n",
            "      FIREBASE_PROJECT_ID: gen-lang-client-0920560496\n",
            "    ports:\n",
            "      - \"4309:4309\"\n",
            "    healthcheck:\n",
            "      test: [\"CMD-SHELL\", \"wget -qO- http://localhost:4309/health || false\"]\n",
            "      interval: 15s\n",
            "      timeout: 10s\n",
            "      retries: 5\n",
            "      start_period: 30s\n",
            "    networks:\n",
            "      - heady-net\n",
            "    restart: unless-stopped\n",
            "\n"
        ])
        inserted = True
    new_lines.append(line)

with open('docker-compose.yml', 'w') as f:
    f.writelines(new_lines)
