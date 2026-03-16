module.exports = {
  apps: [
    {
      name: 'heady-manager',
      script: 'heady-manager.js',
      cwd: '/home/headyme/Heady',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'development',
        HEADY_AUTO_SUCCESS: 'true',
        HEADY_FULL_THROTTLE: 'true',
        HEADY_SAFE_MODE: 'false',
        HEADY_AUTONOMOUS: 'true',
        PORT: 3301,
        FORCE_COLOR: '1',
      },
      // phi-scaled restart delay: 1618ms
      restart_delay: 1618,
      // phi-scaled max restarts: fib(8) = 21 within fib(10)*1000 = 55000ms
      max_restarts: 21,
      min_uptime: '5s',
      // Log paths
      error_file: '/home/headyme/Heady/logs/heady-error.log',
      out_file: '/home/headyme/Heady/logs/heady-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      merge_logs: true,
      // Keep alive forever
      kill_timeout: 8000,
      listen_timeout: 10000,
      // Cron restart daily at 3:14am (pi-time for phi-aligned system)
      cron_restart: '14 3 * * *',
    }
  ]
};
