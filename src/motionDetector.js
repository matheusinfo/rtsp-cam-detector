const { spawn } = require('child_process');
const sharp = require('sharp');
const config = require('./config');

class MotionDetector {
  constructor(rtspUrl) {
    this.rtspUrl = rtspUrl;
    this.motionThreshold = config.MOTION_THRESHOLD;
    this.ffmpegProcess = null;
    this.running = false;
    this.currentFrame = null;
    this.previousFrame = null;
    this.motionDetected = false;
    this.frameBuffer = Buffer.alloc(0);
    this.onFrameCallback = null;
    this.onMotionCallback = null;
    this.lastMotionTime = 0;  // Timestamp da última detecção
    this.motionCooldown = 3000;  // 3 segundos de cooldown
  }

  /**
   * Inicia a captura de vídeo via FFmpeg
   */
  async start() {
    console.log(`🔗 Tentando conectar: ${this.rtspUrl}`);

    this.running = true;
    this.reconnectAttempt = (this.reconnectAttempt || 0) + 1;

    // Argumentos do FFmpeg para captura RTSP (configuração simplificada como ffplay)
    const ffmpegArgs = [
      '-i', this.rtspUrl,
      '-vf', `scale=${config.VIDEO_WIDTH}:${config.VIDEO_HEIGHT}`,
      '-f', 'image2pipe',
      '-c:v', 'mjpeg',
      '-q:v', '5',
      '-r', String(config.STREAM_FPS),
      '-an',
      '-'
    ];

    console.log(`🎬 FFmpeg args: ffmpeg ${ffmpegArgs.join(' ')}`);

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Buffer para acumular dados do frame
    let frameStart = -1;
    let frameEnd = -1;

    this.ffmpegProcess.stdout.on('data', async (data) => {
      // Reset contador de reconexão quando começar a receber dados
      if (this.reconnectAttempt > 1) {
        console.log('✅ Conexão estabelecida com sucesso!');
        this.reconnectAttempt = 1;
      }

      // Acumula dados no buffer
      this.frameBuffer = Buffer.concat([this.frameBuffer, data]);

      // Procura por marcadores JPEG (SOI: 0xFFD8, EOI: 0xFFD9)
      while (true) {
        frameStart = this._findJpegStart(this.frameBuffer);
        if (frameStart === -1) {
          // Não encontrou início, limpa buffer anterior
          this.frameBuffer = Buffer.alloc(0);
          break;
        }

        frameEnd = this._findJpegEnd(this.frameBuffer, frameStart);
        if (frameEnd === -1) {
          // Frame incompleto, aguarda mais dados
          break;
        }

        // Extrai o frame completo
        const frameData = this.frameBuffer.slice(frameStart, frameEnd + 2);
        this.frameBuffer = this.frameBuffer.slice(frameEnd + 2);

        // Processa o frame
        await this._processFrame(frameData);
      }
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      // Loga informações úteis de conexão
      if (message.includes('Stream #') || message.includes('Input #')) {
        console.log(`📺 ${message.trim()}`);
      }
      // Loga erros importantes
      if (message.toLowerCase().includes('error')) {
        console.error(`FFmpeg erro: ${message.trim()}`);
      }
    });

    this.ffmpegProcess.on('error', (err) => {
      console.error(`❌ Erro ao iniciar FFmpeg: ${err.message}`);
      this.running = false;
    });

    this.ffmpegProcess.on('close', (code) => {
      if (code !== 0 && this.running) {
        const maxAttempts = 10;
        if (this.reconnectAttempt < maxAttempts) {
          console.log(`⚠️ FFmpeg encerrou com código ${code}, tentando reconectar (${this.reconnectAttempt}/${maxAttempts})...`);
          setTimeout(() => {
            if (this.running) {
              this.start();
            }
          }, 3000);
        } else {
          console.error(`❌ Máximo de tentativas (${maxAttempts}) atingido. Verifique a URL RTSP.`);
          this.running = false;
        }
      }
    });

    console.log('✅ Stream iniciado com sucesso');
  }

  /**
   * Para a captura de vídeo
   */
  stop() {
    console.log('🛑 Parando detector de movimento...');
    this.running = false;
    this.reconnectAttempt = 0;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }

    this.currentFrame = null;
    this.previousFrame = null;
    this.frameBuffer = Buffer.alloc(0);
  }

  /**
   * Encontra o início de um frame JPEG (marcador SOI: 0xFFD8)
   */
  _findJpegStart(buffer) {
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Encontra o fim de um frame JPEG (marcador EOI: 0xFFD9)
   */
  _findJpegEnd(buffer, start) {
    for (let i = start + 2; i < buffer.length - 1; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Processa um frame JPEG
   */
  async _processFrame(frameData) {
    try {
      // Armazena o frame atual
      this.previousFrame = this.currentFrame;
      this.currentFrame = frameData;

      // Detecta movimento comparando com frame anterior
      if (this.previousFrame) {
        const motionLevel = await this._detectMotion(this.previousFrame, this.currentFrame);
        
        if (motionLevel > this.motionThreshold) {
          const now = Date.now();
          // Verifica cooldown de 3 segundos
          if (!this.motionDetected && (now - this.lastMotionTime) >= this.motionCooldown) {
            this.motionDetected = true;
            this.lastMotionTime = now;
            console.log(`🚨 Movimento detectado! Nível: ${motionLevel}`);
            if (this.onMotionCallback) {
              this.onMotionCallback(motionLevel);
            }
          }
        } else {
          this.motionDetected = false;
        }
      }

      // Callback para novo frame
      if (this.onFrameCallback) {
        this.onFrameCallback(frameData);
      }
    } catch (err) {
      // Ignora erros de processamento de frames individuais
    }
  }

  /**
   * Detecta movimento comparando dois frames
   * Retorna um valor numérico representando a quantidade de movimento
   */
  async _detectMotion(frame1, frame2) {
    try {
      // Converte frames para grayscale e redimensiona para análise rápida
      const [gray1, gray2] = await Promise.all([
        sharp(frame1)
          .grayscale()
          .resize(160, 120) // Resolução menor para análise rápida
          .raw()
          .toBuffer(),
        sharp(frame2)
          .grayscale()
          .resize(160, 120)
          .raw()
          .toBuffer()
      ]);

      // Calcula a diferença absoluta entre os frames
      let totalDiff = 0;
      let changedPixels = 0;
      const threshold = 30; // Limite para considerar um pixel como "alterado"

      for (let i = 0; i < gray1.length; i++) {
        const diff = Math.abs(gray1[i] - gray2[i]);
        if (diff > threshold) {
          changedPixels++;
          totalDiff += diff;
        }
      }

      // Retorna a soma das diferenças dos pixels alterados
      return totalDiff;
    } catch (err) {
      return 0;
    }
  }

  /**
   * Retorna o frame atual como string base64
   */
  getCurrentFrame() {
    if (this.currentFrame) {
      return this.currentFrame.toString('base64');
    }
    return null;
  }

  /**
   * Retorna o frame atual como Buffer (para salvar arquivo)
   */
  getCurrentFrameBuffer() {
    return this.currentFrame;
  }

  /**
   * Verifica se movimento foi detectado
   */
  isMotionDetected() {
    return this.motionDetected;
  }

  /**
   * Reseta a detecção de movimento
   */
  resetMotionDetection() {
    this.motionDetected = false;
  }

  /**
   * Define callback para novos frames
   */
  onFrame(callback) {
    this.onFrameCallback = callback;
  }

  /**
   * Define callback para detecção de movimento
   */
  onMotion(callback) {
    this.onMotionCallback = callback;
  }
}

module.exports = MotionDetector;
