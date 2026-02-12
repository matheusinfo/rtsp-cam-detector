module.exports = {
  apps: [{
    name: 'rtsp-cam-detector',
    script: './src/app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/dev/null',
    out_file: '/dev/null',
    log_file: '/dev/null',
    time: false,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
    instance_var: 'INSTANCE_ID'
  }]
};