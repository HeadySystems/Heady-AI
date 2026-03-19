# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: drupal/Dockerfile                                                    ║
# ║  LAYER: root                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END
<<<<<<< HEAD

# Drupal 11 with PHP 8.2
FROM drupal:11-php8.2-apache

# Install dependencies (sqlite3 for local dev, git for composer)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    unzip \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Drush via Composer
RUN composer require drush/drush --working-dir=/opt/drupal

WORKDIR /opt/drupal/web

# Copy custom themes and modules (if they exist)
COPY themes/custom/ themes/custom/ 2>/dev/null || true
COPY modules/custom/ modules/custom/ 2>/dev/null || true

# Copy settings if available
COPY settings.php sites/default/settings.php 2>/dev/null || true

# Ensure writable directories
RUN mkdir -p sites/default/files/private && \
    chown -R www-data:www-data sites/default/files

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -sf http://localhost/core/install.php || exit 1
=======
# Drupal 11 with PHP 8.2
FROM drupal:11-php8.2-apache

# Install dependencies
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    php8.2-pgsql \
    composer \
    && rm -rf /var/lib/apt/lists/*

# Install Drush
RUN composer global require drush/drush

# Set working directory
WORKDIR /var/www/html

# Copy custom settings
COPY settings.php /sites/default/settings.php
RUN chmod 644 /sites/default/settings.php

# Copy all Drupal customizations
COPY themes/custom/ /var/www/html/themes/custom/
COPY modules/custom/ /var/www/html/modules/custom/

# Install Heady theme
RUN drush en heady_theme -y
RUN drush config-set system.theme default heady_theme -y

# Configure SQLite database
RUN mkdir -p /var/www/html/sites/default/files/private
RUN sqlite3 /var/www/html/sites/default/files/.ht.sqlite "VACUUM;"
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
