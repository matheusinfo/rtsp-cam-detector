// Conecta ao Socket.IO
const socket = io();

// Elementos da interface
const rtspUrlInput = document.getElementById('rtsp-url');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDiv = document.getElementById('status');
const motionIndicator = document.getElementById('motion-indicator');
const videoPlaceholder = document.getElementById('video-placeholder');
const videoLoading = document.getElementById('video-loading');
const videoStream = document.getElementById('video-stream');
const motionList = document.getElementById('motion-list');
const alertSound = document.getElementById('alert-sound');

// Estado da aplicação
let isConnected = false;
let isStreaming = false;
let motionCount = 0;

// Configura som de alerta
function setupAlertSound() {
    // Se não há arquivo de som, cria um beep usando Web Audio API
    if (alertSound.canPlayType('audio/mpeg') === '' && alertSound.canPlayType('audio/wav') === '') {
        console.log('Usando som sintético para alertas');
    }
}

// Reproduz som de alerta
function playAlertSound() {
    try {
        // Tenta reproduzir o arquivo de áudio
        alertSound.currentTime = 0;
        const playPromise = alertSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Se falhar, cria um beep sintético
                createBeepSound();
            });
        }
    } catch (error) {
        // Fallback para beep sintético
        createBeepSound();
    }
}

// Cria beep sintético usando Web Audio API
function createBeepSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Frequência do beep
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.error('Erro ao criar som de alerta:', error);
    }
}

// Atualiza status da conexão
function updateConnectionStatus(connected) {
    isConnected = connected;
    statusDiv.textContent = connected ? '🟢 Conectado' : '🔴 Desconectado';
    statusDiv.className = connected ? 'status connected' : 'status';
}

// Atualiza indicador de movimento
function updateMotionIndicator(motion) {
    if (motion) {
        motionIndicator.textContent = '🚨 Movimento detectado!';
        motionIndicator.className = 'motion-indicator motion-detected';
        
        // Remove o efeito após 3 segundos
        setTimeout(() => {
            motionIndicator.textContent = '👁️ Monitorando...';
            motionIndicator.className = 'motion-indicator';
        }, 3000);
    }
}

// Adiciona item ao log de movimentos
function addMotionToLog(timestamp, screenshot) {
    motionCount++;
    const date = new Date(timestamp);
    const timeString = date.toLocaleTimeString('pt-BR');
    const dateString = date.toLocaleDateString('pt-BR');
    
    // Remove mensagem "nenhum movimento"
    const noMotion = motionList.querySelector('.no-motion');
    if (noMotion) {
        noMotion.remove();
    }
    
    // Cria novo item
    const motionItem = document.createElement('div');
    motionItem.className = 'motion-item';
    motionItem.dataset.screenshot = screenshot;
    motionItem.dataset.number = motionCount;
    motionItem.dataset.date = `${dateString} às ${timeString}`;
    motionItem.innerHTML = `
        <strong>Movimento #${motionCount}</strong><br>
        📅 ${dateString} às ${timeString}
        <span style="float: right; color: #667eea;">📷 Ver foto</span>
    `;
    
    // Adiciona evento de clique
    motionItem.addEventListener('click', () => openScreenshotModal(motionItem));
    
    // Adiciona no topo da lista
    motionList.insertBefore(motionItem, motionList.firstChild);
    
    // Limita a 50 itens
    while (motionList.children.length > 50) {
        motionList.removeChild(motionList.lastChild);
    }
}

// Event Listeners dos botões
startBtn.addEventListener('click', () => {
    const rtspUrl = rtspUrlInput.value.trim();
    
    if (!rtspUrl) {
        alert('Por favor, insira a URL da câmera RTSP');
        return;
    }
    
    startBtn.disabled = true;
    startBtn.textContent = '🔄 Conectando...';
    
    // Mostra loading
    videoPlaceholder.style.display = 'none';
    videoLoading.style.display = 'flex';
    videoStream.style.display = 'none';
    
    socket.emit('start_stream', { rtsp_url: rtspUrl });
});

stopBtn.addEventListener('click', () => {
    socket.emit('stop_stream');
});

// Socket.IO Event Handlers
socket.on('connect', () => {
    console.log('Conectado ao servidor');
    updateConnectionStatus(true);
});

socket.on('disconnect', () => {
    console.log('Desconectado do servidor');
    updateConnectionStatus(false);
    isStreaming = false;
    
    // Reset da interface
    startBtn.disabled = false;
    startBtn.textContent = '▶️ Iniciar';
    stopBtn.disabled = true;
    
    videoStream.style.display = 'none';
    videoLoading.style.display = 'none';
    videoPlaceholder.style.display = 'block';
    
    motionIndicator.textContent = '👁️ Sem movimento';
    motionIndicator.className = 'motion-indicator';
});

socket.on('stream_started', (data) => {
    if (data.success) {
        console.log('Stream iniciado com sucesso');
        isStreaming = true;
        
        startBtn.disabled = true;
        startBtn.textContent = '✅ Ativo';
        stopBtn.disabled = false;
        
        motionIndicator.textContent = '👁️ Monitorando...';
        motionIndicator.className = 'motion-indicator';
        
        // Esconde loading/placeholder e mostra vídeo
        videoPlaceholder.style.display = 'none';
        videoLoading.style.display = 'none';
        videoStream.style.display = 'block';
    }
});

socket.on('stream_stopped', (data) => {
    if (data.success) {
        console.log('Stream parado');
        isStreaming = false;
        
        startBtn.disabled = false;
        startBtn.textContent = '▶️ Iniciar';
        stopBtn.disabled = true;
        
        // Esconde vídeo/loading e mostra placeholder
        videoStream.style.display = 'none';
        videoLoading.style.display = 'none';
        videoPlaceholder.style.display = 'block';
        
        motionIndicator.textContent = '👁️ Sem movimento';
        motionIndicator.className = 'motion-indicator';
    }
});

socket.on('new_frame', (data) => {
    if (isStreaming && data.frame) {
        videoStream.src = 'data:image/jpeg;base64,' + data.frame;
    }
});

socket.on('motion_detected', (data) => {
    console.log('Movimento detectado!', new Date(data.timestamp));
    
    // Atualiza interface
    updateMotionIndicator(true);
    
    // Adiciona ao log com screenshot
    addMotionToLog(data.timestamp, data.screenshot);
    
    // Reproduz som de alerta
    playAlertSound();
});

socket.on('error', (data) => {
    console.error('Erro:', data.message);
    alert('Erro: ' + data.message);
    
    // Reset do botão e interface
    startBtn.disabled = false;
    startBtn.textContent = '▶️ Iniciar';
    videoLoading.style.display = 'none';
    videoPlaceholder.style.display = 'block';
});

socket.on('status', (data) => {
    console.log('Status:', data.message);
});

// Permitir interação com o usuário para habilitar áudio
document.addEventListener('click', () => {
    setupAlertSound();
}, { once: true });

// Modal para screenshot
const modal = document.getElementById('screenshot-modal');
const modalImage = document.getElementById('modal-image');
const modalTitle = document.getElementById('modal-title');
const modalInfo = document.getElementById('modal-info');
const modalClose = document.querySelector('.modal-close');

function openScreenshotModal(motionItem) {
    const screenshot = motionItem.dataset.screenshot;
    const number = motionItem.dataset.number;
    const date = motionItem.dataset.date;
    
    if (screenshot) {
        modalImage.src = `/screenshots/${screenshot}`;
        modalTitle.textContent = `Movimento #${number}`;
        modalInfo.textContent = `Capturado em ${date}`;
        modal.classList.add('show');
    } else {
        alert('Screenshot não disponível');
    }
}

function closeScreenshotModal() {
    modal.classList.remove('show');
    modalImage.src = '';
}

// Event listeners do modal
modalClose.addEventListener('click', closeScreenshotModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeScreenshotModal();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeScreenshotModal();
    }
});

// Carrega screenshots existentes
async function loadExistingScreenshots() {
    try {
        const response = await fetch('/api/screenshots');
        const screenshots = await response.json();
        
        if (screenshots.length > 0) {
            // Remove mensagem "nenhum movimento"
            const noMotion = motionList.querySelector('.no-motion');
            if (noMotion) {
                noMotion.remove();
            }
            
            // Adiciona cada screenshot ao log
            screenshots.forEach((item, index) => {
                motionCount++;
                const date = new Date(item.timestamp);
                const timeString = date.toLocaleTimeString('pt-BR');
                const dateString = date.toLocaleDateString('pt-BR');
                
                const motionItem = document.createElement('div');
                motionItem.className = 'motion-item';
                motionItem.dataset.screenshot = item.filename;
                motionItem.dataset.number = motionCount;
                motionItem.dataset.date = `${dateString} às ${timeString}`;
                motionItem.innerHTML = `
                    <strong>Movimento #${motionCount}</strong><br>
                    📅 ${dateString} às ${timeString}
                    <span style="float: right; color: #667eea;">📷 Ver foto</span>
                `;
                
                motionItem.addEventListener('click', () => openScreenshotModal(motionItem));
                motionList.appendChild(motionItem);
            });
            
            console.log(`📷 ${screenshots.length} screenshots carregadas`);
        }
    } catch (err) {
        console.error('Erro ao carregar screenshots:', err);
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('Monitor de Movimento RTSP carregado');
    updateConnectionStatus(false);
    loadExistingScreenshots();
});
