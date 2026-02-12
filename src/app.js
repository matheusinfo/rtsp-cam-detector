const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const MotionDetector = require('./motionDetector');

// Diretório para screenshots
const screenshotsDir = path.join(__dirname, '..', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Inicializa Express
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve arquivos estáticos
app.use('/static', express.static(path.join(__dirname, '..', 'static')));
app.use('/screenshots', express.static(screenshotsDir));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'templates', 'index.html'));
});

// Rota para obter screenshot
app.get('/api/screenshot/:filename', (req, res) => {
  const filePath = path.join(screenshotsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Screenshot não encontrada' });
  }
});

// Rota para listar todas as screenshots
app.get('/api/screenshots', (req, res) => {
  try {
    const files = fs.readdirSync(screenshotsDir)
      .filter(f => f.endsWith('.jpg'))
      .map(filename => {
        const match = filename.match(/motion_(\d+)\.jpg/);
        return {
          filename,
          timestamp: match ? parseInt(match[1], 10) : 0
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp); // Mais recente primeiro
    res.json(files);
  } catch (err) {
    res.json([]);
  }
});

// Estado global
let motionDetector = null;
let streaming = false;
let streamInterval = null;
let motionInterval = null;

// Handlers do Socket.IO
io.on('connection', (socket) => {
  console.log('👤 Cliente conectado:', socket.id);
  socket.emit('status', { message: 'Conectado ao servidor' });

  // Iniciar stream
  socket.on('start_stream', async (data) => {
    try {
      const rtspUrl = data?.rtsp_url;
      
      if (!rtspUrl) {
        socket.emit('error', { message: 'URL RTSP não informada' });
        return;
      }
      
      console.log(`🎥 Iniciando stream: ${rtspUrl}`);

      // Para o detector anterior se existir
      if (motionDetector) {
        stopStreaming();
      }

      // Cria novo detector
      motionDetector = new MotionDetector(rtspUrl);
      
      // Callback para detecção de movimento
      motionDetector.onMotion((level) => {
        const timestamp = Date.now();
        const filename = `motion_${timestamp}.jpg`;
        
        // Salva screenshot
        const frame = motionDetector.getCurrentFrameBuffer();
        if (frame) {
          const filePath = path.join(screenshotsDir, filename);
          fs.writeFile(filePath, frame, (err) => {
            if (err) {
              console.error('Erro ao salvar screenshot:', err);
            } else {
              console.log(`📸 Screenshot salva: ${filename}`);
            }
          });
        }
        
        io.emit('motion_detected', { 
          timestamp: timestamp,
          level: level,
          screenshot: filename
        });
      });

      await motionDetector.start();
      streaming = true;

      // Intervalo para enviar frames
      streamInterval = setInterval(() => {
        if (streaming && motionDetector) {
          const frame = motionDetector.getCurrentFrame();
          if (frame) {
            io.emit('new_frame', { frame });
          }
        }
      }, 1000 / config.STREAM_FPS);

      socket.emit('stream_started', { success: true });

    } catch (err) {
      console.error(`❌ Erro ao iniciar stream: ${err.message}`);
      socket.emit('error', { message: `Erro ao conectar com a câmera: ${err.message}` });
    }
  });

  // Parar stream
  socket.on('stop_stream', () => {
    stopStreaming();
    socket.emit('stream_stopped', { success: true });
    console.log('⏹️ Stream parado');
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log('👋 Cliente desconectado:', socket.id);
  });
});

/**
 * Para o streaming e limpa recursos
 */
function stopStreaming() {
  streaming = false;

  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }

  if (motionInterval) {
    clearInterval(motionInterval);
    motionInterval = null;
  }

  if (motionDetector) {
    motionDetector.stop();
    motionDetector = null;
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor...');
  stopStreaming();
  
  // Fecha todas as conexões Socket.IO
  io.close(() => {
    server.close(() => {
      console.log('👋 Servidor encerrado graciosamente');
      process.exit(0);
    });
  });
  
  // Força encerramento após 3 segundos
  setTimeout(() => {
    console.log('⚠️ Forçando encerramento...');
    process.exit(0);
  }, 3000);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, encerrando...');
  stopStreaming();
  io.close();
  server.close(() => {
    process.exit(0);
  });
  
  setTimeout(() => process.exit(0), 3000);
});

// Inicia o servidor
server.listen(config.PORT, config.HOST, () => {
  console.log('🎥 Iniciando Monitor de Movimento RTSP (Node.js)...');
  console.log(`🌐 Servidor: http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}`);
  console.log('📱 Acesse a interface web no navegador');
  console.log('🔊 Clique uma vez na página para habilitar alertas sonoros');
  console.log('⏹️  Pressione Ctrl+C para parar');
});
