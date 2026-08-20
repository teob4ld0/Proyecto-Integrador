import { spawn } from 'node:child_process';

const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:8080';
const frontendHost = process.env.FRONTEND_HOST || '0.0.0.0';
const frontendPort = process.env.FRONTEND_PORT || '4173';
const frontendBaseUrl = process.env.FRONTEND_BASE_URL || `http://localhost:${frontendPort}`;

async function isFrontendRunning() {
  try {
    const res = await fetch(frontendBaseUrl, { method: 'GET' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

function openUrlInBrowser(url) {
  if (process.platform === 'win32') {
    const opener = spawn('cmd', ['/c', 'start', '', url], {
      stdio: 'ignore',
      detached: true,
    });
    opener.unref();
    return;
  }

  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const opener = spawn(cmd, [url], {
    stdio: 'ignore',
    detached: true,
  });
  opener.unref();
}

async function createRoom() {
  const token = `mock_token_${Date.now()}`;
  const roomName = `AutoRoom-${Date.now().toString().slice(-6)}`;

  const response = await fetch(`${backendBaseUrl}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: roomName,
      map: 'classic',
      maxPlayers: 4,
      isPublic: true,
      difficulty: 'normal',
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || `HTTP ${response.status}`;
    throw new Error(`No se pudo crear la sala: ${message}`);
  }

  return { room: data, token };
}

function buildPlayRoute(roomId, token) {
  const params = new URLSearchParams({
    roomId,
    class: 'attack',
    token,
    difficulty: 'normal',
  });

  const playPath = `/play?${params.toString()}`;
  const playUrl = `${frontendBaseUrl}${playPath}`;

  return { playPath, playUrl };
}

function printRoomInfo(roomId, token, playUrl) {
  console.log('');
  console.log('[auto-room] Sala creada con exito');
  console.log(`[auto-room] roomId: ${roomId}`);
  console.log(`[auto-room] token: ${token}`);
  console.log(`[auto-room] URL: ${playUrl}`);
  console.log('');
}

function runViteWithRoom(playPath) {

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = [
    'run',
    'dev',
    '--',
    '--host',
    frontendHost,
    '--port',
    String(frontendPort),
    '--open',
    playPath,
  ];

  const child = spawn(npmCmd, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  try {
    const { room, token } = await createRoom();
    if (!room?.id) {
      throw new Error('Respuesta de sala invalida: falta room.id');
    }

    const { playPath, playUrl } = buildPlayRoute(room.id, token);
    printRoomInfo(room.id, token, playUrl);

    if (await isFrontendRunning()) {
      console.log('[auto-room] Frontend ya estaba levantado. Abriendo URL de la nueva sala...');
      openUrlInBrowser(playUrl);
      return;
    }

    runViteWithRoom(playPath);
  } catch (error) {
    console.error('[auto-room] Error:', error instanceof Error ? error.message : String(error));
    console.error('[auto-room] Asegurate de tener backend levantado en', backendBaseUrl);
    process.exit(1);
  }
}

main();
