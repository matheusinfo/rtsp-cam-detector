# Monitor de Movimento RTSP - Node.js

Aplicação para monitoramento de câmeras RTSP com detecção de movimento em tempo real e captura de screenshots.

## Funcionalidades

- Stream de vídeo RTSP em tempo real
- Detecção automática de movimento
- Captura de screenshot no momento do movimento
- Log de movimentos com visualização das imagens
- Alertas sonoros ao detectar movimento
- Interface web responsiva

## Requisitos

- Node.js >= 18.0.0
- FFmpeg instalado no sistema

### Instalando FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## Instalação

```bash
npm install
```

## Configuração

1. Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` conforme necessário (todas as configurações são opcionais):
```env
# Porta do servidor web
PORT=5000

# Sensibilidade de detecção (menor = mais sensível)
MOTION_THRESHOLD=5000
```

## Uso

```bash
# Modo produção
npm start

# Modo desenvolvimento (com hot reload)
npm run dev
```

1. Acesse http://localhost:5000 no navegador
2. Digite a URL RTSP da sua câmera (ex: `rtsp://usuario:senha@ip:porta/stream`)
3. Clique em "Iniciar"
4. Movimentos detectados serão registrados no log com screenshot
5. Clique em um movimento para ver a imagem capturada

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `HOST` | Host do servidor | 0.0.0.0 |
| `PORT` | Porta do servidor | 5000 |
| `MOTION_THRESHOLD` | Sensibilidade de detecção | 5000 |
| `STREAM_FPS` | FPS do stream web | 10 |
| `VIDEO_WIDTH` | Largura do vídeo | 640 |
| `VIDEO_HEIGHT` | Altura do vídeo | 480 |

## Estrutura do Projeto

```
rtsp-cam-detector/
├── src/
│   ├── app.js            # Servidor Express + Socket.IO
│   ├── config.js         # Configurações (carrega .env)
│   └── motionDetector.js # Detector de movimento via FFmpeg
├── static/
│   ├── style.css         # Estilos da interface
│   └── script.js         # JavaScript do cliente
├── templates/
│   └── index.html        # Página principal
├── screenshots/          # Screenshots de movimentos (gerado automaticamente)
├── .env                  # Configurações locais
├── .env.example          # Template de configuração
└── package.json          # Dependências
```

## Tecnologias

- **Express** - Servidor HTTP
- **Socket.IO** - Comunicação em tempo real
- **FFmpeg** - Captura de stream RTSP
- **Sharp** - Processamento de imagens para detecção

