FROM drupal:11-php8.3-fpm-alpine

# Install drush and required dependencies for Cloud Run (Cloud SQL proxy if needed)
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
RUN composer require drush/drush

# Configure Drupal for Headless JSON:API Operations
COPY settings.php /opt/drupal/web/sites/default/settings.php

# We enable the JSON:API module natively
RUN vendor/bin/drush en jsonapi -y

# Copy custom modules if any
# COPY modules/ /opt/drupal/web/modules/custom/

# Entrypoint configures Apache/PHP-FPM to listen on PORT environment variable (Cloud Run constraint)
EXPOSE 8080
CMD ["php-fpm"]
