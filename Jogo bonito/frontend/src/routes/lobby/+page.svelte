<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { base } from '$app/paths';
  import { APIClient, type RoomData } from '$lib/network/apiClient';
  import { SignalWSClient, CHARACTER_CLASSES, type CharacterClass } from '$lib/network/signalClient';

  let rooms = $state<RoomData[]>([]);
  let loading = $state(true);
  let errorMsg = $state('');

  // Sesión y Token
  let token = $state('');
  let username = $state('Jugador');

  // Modales
  let showCreateModal = $state(false);
  let showCharSelectModal = $state(false);
  let activeRoom = $state<RoomData | null>(null);

  // Formulario Crear Sala
  let newRoomName = $state('');
  let newRoomDifficulty = $state<'normal' | 'difficult' | 'no_mercy'>('normal');

  // Selección de Personaje
  let selectedClass = $state<CharacterClass>(CHARACTER_CLASSES[0]);
  let playerCharacters = $state<Record<string, string>>({});
  let signalClient: SignalWSClient | null = null;
  let isReady = $state(false);

  onMount(async () => {
    try {
      // 1. Obtener o generar token de sesión
      let existingToken = APIClient.getToken();
      if (!existingToken) {
        // Registrar o loguear usuario anónimo para desarrollo rápido
        const guestEmail = `guest_${Math.floor(Math.random() * 10000)}@danmakrew.local`;
        const guestPass = 'GuestPass123!';
        const guestUser = `Player_${Math.floor(Math.random() * 1000)}`;

        try {
          await APIClient.register(guestUser, guestEmail, guestPass);
        } catch {
          // Ignorar si ya existe
        }
        try {
          const auth = await APIClient.login(guestEmail, guestPass);
          existingToken = auth.token;
          username = auth.username;
        } catch (e) {
          // Fallback a token sintético si backend no tiene DB lista
          existingToken = `mock_token_${Date.now()}`;
          APIClient.setToken(existingToken);
        }
      }
      token = existingToken || '';

      // Intento opcional de obtener info de usuario
      try {
        const me = await APIClient.getMe();
        username = me.username;
      } catch {
        // usar default username
      }

      // 2. Cargar Salas desde REST API
      await fetchRooms();
    } catch (e: any) {
      errorMsg = e.message || 'Error inicializando sesión';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    signalClient?.disconnect();
  });

  async function fetchRooms() {
    try {
      rooms = await APIClient.listRooms();
    } catch (e) {
      console.warn('[Lobby] No se pudieron cargar las salas desde REST API, usando modo fallback');
    }
  }

  async function handleCreateRoom() {
    if (!newRoomName) return;
    try {
      loading = true;
      const room = await APIClient.createRoom({
        name: newRoomName,
        difficulty: newRoomDifficulty,
        maxPlayers: 4,
        isPublic: true,
      });

      showCreateModal = false;
      newRoomName = '';
      await openRoomSelection(room, true);
    } catch (e: any) {
      alert(`Error creando sala: ${e.message}`);
    } finally {
      loading = false;
    }
  }

  async function handleJoinRoom(room: RoomData) {
    try {
      loading = true;
      const joined = await APIClient.joinRoom(room.id);
      await openRoomSelection(joined.room || room, false);
    } catch (e: any) {
      // Si el error dice que somos el host o ya estamos en la sala
      await openRoomSelection(room, false);
    } finally {
      loading = false;
    }
  }

  async function openRoomSelection(room: RoomData, isHost: boolean) {
    activeRoom = room;
    showCharSelectModal = true;

    // Inicializar cliente WebSocket de Señalización
    if (token) {
      signalClient?.disconnect();
      signalClient = new SignalWSClient(token);
      try {
        await signalClient.connect();
        if (isHost) {
          signalClient.hostRoom(room.id);
        } else {
          signalClient.joinRoom(room.id);
        }

        signalClient.onMessage((msg) => {
          if (msg.type === 'room-joined' || msg.type === 'room-updated' || msg.type === 'room-character-updated') {
            playerCharacters = msg.playerCharacters || {};
          }
        });
      } catch (e) {
        console.warn('[LobbyWS] No se pudo conectar a WS de señalización, continuando en modo local:', e);
      }
    }
  }

  function selectCharacter(char: CharacterClass) {
    selectedClass = char;
    if (activeRoom && signalClient) {
      signalClient.setCharacter(char.color, activeRoom.id);
    }
  }

  function confirmAndStart() {
    if (!activeRoom) return;
    isReady = true;

    // Navegar a la pantalla de juego con la sala y token
    const difficulty = encodeURIComponent(activeRoom.difficulty || 'normal');
    const playUrl = `${base}/play?roomId=${encodeURIComponent(activeRoom.id)}&class=${encodeURIComponent(selectedClass.id)}&color=${encodeURIComponent(selectedClass.color)}&token=${encodeURIComponent(token)}&difficulty=${difficulty}`;
    window.location.href = playUrl;
  }
</script>

<svelte:head>
  <title>Lobby - Seleccionar Personaje | Jogo Bonito</title>
</svelte:head>

<div class="lobby-container">
  <div class="glass-panel main-panel">
    <div class="header">
      <div>
        <h1 class="title-glow">JOGO BONITO - SALAS MULTIJUGADOR</h1>
        <p class="subtitle-glow">Bullet Hell Horizontal | Fastify v4 + uWebSockets.js</p>
      </div>
      <button class="btn-primary" onclick={() => showCreateModal = true}>
        + CREAR SALA
      </button>
    </div>

    {#if loading}
      <div class="loading-box">Cargando salas de juego...</div>
    {:else if rooms.length === 0}
      <div class="empty-box">
        <p>No hay salas activas en este momento.</p>
        <button class="btn-secondary" onclick={() => showCreateModal = true}>¡Sé el primero en crear una!</button>
      </div>
    {:else}
      <div class="rooms-list">
        {#each rooms as room}
          <div class="glass-card room-card">
            <div class="room-info">
              <span class="difficulty-tag {room.difficulty || 'normal'}">{room.difficulty || 'Normal'}</span>
              <h3 class="room-title">{room.name}</h3>
              <p class="room-meta">ID: <span class="highlight">{room.id.slice(0, 8)}</span> | Máx: {room.maxPlayers} Jugadores</p>
            </div>
            <div class="room-action">
              <div class="players-count">
                <span class="count">{room.playersCount || room.players?.length || 1}/{room.maxPlayers}</span>
                <span class="label">JUGADORES</span>
              </div>
              <button class="btn-secondary join-btn" onclick={() => handleJoinRoom(room)}>
                UNIRSE Y ELEGIR PERSONAJE
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- MODAL: CREAR SALA -->
  {#if showCreateModal}
    <div class="modal-backdrop" role="button" tabindex="0" onclick={() => showCreateModal = false} onkeydown={(e) => e.key === 'Escape' && (showCreateModal = false)}>
      <div class="glass-panel modal-box" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
        <h2>NUEVA SALA DE JUEGO</h2>
        <div class="field">
          <label for="rname">Nombre de la Sala</label>
          <input id="rname" class="input-glass" bind:value={newRoomName} placeholder="Ej. Touhou Boss Fight..." />
        </div>
        <div class="field">
          <label for="rdiff">Dificultad Danmaku</label>
          <select id="rdiff" class="input-glass" bind:value={newRoomDifficulty}>
            <option value="normal">Normal</option>
            <option value="difficult">Dificil</option>
            <option value="no_mercy">Sin Piedad (Lunatic)</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick={() => showCreateModal = false}>CANCELAR</button>
          <button class="btn-primary" onclick={handleCreateRoom}>CREAR Y CONECTAR</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- PANTALLA / MODAL DE SELECCIÓN DE PERSONAJES -->
  {#if showCharSelectModal && activeRoom}
    <div class="modal-backdrop char-backdrop">
      <div class="glass-panel char-modal-box">
        <div class="modal-header">
          <h2>SELECCIÓN DE PERSONAJE</h2>
          <p class="room-subtitle">Sala: <strong>{activeRoom.name}</strong> ({activeRoom.playersCount || 1}/{activeRoom.maxPlayers})</p>
        </div>

        <div class="characters-grid">
          {#each CHARACTER_CLASSES as char}
            <div
              class="char-card {selectedClass.id === char.id ? 'selected' : ''}"
              role="button"
              tabindex="0"
              onclick={() => selectCharacter(char)}
              onkeydown={(e) => e.key === 'Enter' && selectCharacter(char)}
            >
              <div class="sprite-box">
                <img src="{base}{char.spriteUrl}" alt="{char.name}" class="char-sprite" />
              </div>
              <h3 class="char-name">{char.name}</h3>
              <span class="char-role">{char.role}</span>
              <p class="char-desc">{char.description}</p>

              <div class="stats-list">
                <div class="stat-row">
                  <span>Ataque:</span>
                  <div class="stat-bar"><div class="fill" style="width: {char.stats.attack}%"></div></div>
                </div>
                <div class="stat-row">
                  <span>Defensa:</span>
                  <div class="stat-bar"><div class="fill" style="width: {char.stats.defense}%"></div></div>
                </div>
                <div class="stat-row">
                  <span>Velocidad:</span>
                  <div class="stat-bar"><div class="fill" style="width: {char.stats.speed}%"></div></div>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="char-confirm-bar">
          <div class="selected-summary">
            <span>Personaje Seleccionado: <strong style="color: #00f2fe;">{selectedClass.name}</strong> ({selectedClass.role})</span>
          </div>
          <div class="confirm-buttons">
            <button class="btn-secondary" onclick={() => showCharSelectModal = false}>SALIR DE SALA</button>
            <button class="btn-primary confirm-btn" onclick={confirmAndStart}>
              CONFIRMAR Y JUGAR
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .lobby-container {
    flex: 1;
    padding: 2.5rem;
    display: flex;
    justify-content: center;
  }

  .main-panel {
    max-width: 1100px;
    width: 100%;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 1.5rem;
  }

  .loading-box, .empty-box {
    text-align: center;
    padding: 3rem;
    color: var(--text-muted);
  }

  .rooms-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .room-card {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .room-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: white;
    margin: 0.4rem 0;
  }

  .room-meta {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .highlight {
    color: var(--text-main);
    font-weight: 600;
  }

  .difficulty-tag {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .difficulty-tag.normal { background: rgba(0, 242, 254, 0.15); color: var(--cyan-glow); border: 1px solid var(--cyan-glow); }
  .difficulty-tag.difficult { background: rgba(255, 183, 3, 0.15); color: var(--gold-glow); border: 1px solid var(--gold-glow); }
  .difficulty-tag.no_mercy { background: rgba(255, 43, 91, 0.15); color: var(--primary-glow); border: 1px solid var(--primary-glow); }

  .room-action {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .players-count {
    text-align: right;
  }

  .players-count .count {
    font-family: var(--font-display);
    font-size: 1.3rem;
    color: white;
    display: block;
  }

  .players-count .label {
    font-size: 0.7rem;
    color: var(--text-muted);
    letter-spacing: 1px;
  }

  /* Modales */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(4, 6, 15, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-box {
    width: 480px;
    padding: 2.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field label {
    font-family: var(--font-display);
    font-size: 0.85rem;
    color: var(--cyan-glow);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
  }

  /* Modal de Selección de Personajes */
  .char-modal-box {
    width: 90%;
    max-width: 1100px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: #090714;
    border: 2px solid #ff2b5b;
  }

  .modal-header h2 {
    font-family: var(--font-display);
    font-size: 1.8rem;
    color: #ff2b5b;
    margin: 0;
  }

  .room-subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .characters-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.2rem;
  }

  .char-card {
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
  }

  .char-card:hover {
    transform: translateY(-4px);
    border-color: rgba(0, 242, 254, 0.5);
  }

  .char-card.selected {
    border-color: #ff2b5b;
    background: rgba(255, 43, 91, 0.12);
    box-shadow: 0 0 20px rgba(255, 43, 91, 0.4);
  }

  .sprite-box {
    width: 90px;
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.15);
    margin-bottom: 0.8rem;
  }

  .char-sprite {
    max-width: 70px;
    max-height: 70px;
    object-fit: contain;
  }

  .char-name {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: white;
    margin: 0;
  }

  .char-role {
    font-size: 0.75rem;
    color: #00f2fe;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .char-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    height: 48px;
    margin-bottom: 1rem;
  }

  .stats-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #bbb;
  }

  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stat-bar {
    width: 60%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
  }

  .stat-bar .fill {
    height: 100%;
    background: linear-gradient(90deg, #00f2fe, #ff2b5b);
  }

  .char-confirm-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
  }

  .confirm-buttons {
    display: flex;
    gap: 1rem;
  }

  .confirm-btn {
    background: linear-gradient(90deg, #ff2b5b, #ff0055);
    font-size: 1.1rem;
    padding: 0.8rem 1.8rem;
  }
</style>
