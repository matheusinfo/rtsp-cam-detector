require('dotenv').config();

module.exports = {
  // Configurações de rede
  HOST: process.env.HOST || '0.0.0.0',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Configurações de detecção de movimento
  MOTION_THRESHOLD: parseInt(process.env.MOTION_THRESHOLD, 10) || 5000,
  STREAM_FPS: parseInt(process.env.STREAM_FPS, 10) || 10,

  // Configurações de vídeo
  VIDEO_WIDTH: parseInt(process.env.VIDEO_WIDTH, 10) || 640,
  VIDEO_HEIGHT: parseInt(process.env.VIDEO_HEIGHT, 10) || 480,
};
