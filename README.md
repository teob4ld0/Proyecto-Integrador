# Proyecto Integrador — Danmakrew

Repositorio unificado de **NoMercyGames** para **Danmakrew**: Bullet Hell cooperativo multijugador con lobby en tiempo real, físicas rígidas **Planck.js**, interpolación y simulación en **Web Workers**, y motor gráfico **PixiJS v7** integrado en **React 19 + Vite**.

---

## Arquitectura y Stack

| Capa | Tecnología |
|------|-----------|
| **API HTTP** | Fastify v4 + Zod (`8080`) |
| **Autenticación y usuarios** | SQLite (`better-sqlite3`) + Lucia v3 |
| **Salas efímeras** | Redis Stack (`ioredis`, TTL 2h) |
| **Señalización & Servidor de Juego WS** | `µWebSockets.js` (`9001` — `/signal` y `/game`) |
| **Físicas autoritativas** | Planck.js (`60 Hz` en servidor y en Web Worker local de respaldo) |
| **Frontend Web + Juego Unificado** | React 19 + React Router v7 + TypeScript + PixiJS v7 + Vite 6 + PWA |
| **Web Workers (Frontend)** | `snapshot.worker.ts` (interpolación 60 FPS) + `gameSimulation.worker.ts` (simulación local Planck.js 60 Hz) |

---

## Estructura del Proyecto

```text
Proyecto-Integrador/
├── Backend/
│   ├── scripts/
│   │   └── testPhysics.js          # Suite automatizada de físicas Danmakrew
│   └── src/
│       ├── config/                 # SQLite, Lucia Auth, Redis, Mailer
│       ├── game/                   # Motor autoritativo 60Hz (GameRoom, Planck.js, Boss, Bullets, Walls)
│       ├── middleware/             # Autenticación de sesiones
│       ├── routes/                 # Auth, amigos, salas (roomRoutes.js)
│       ├── utils/                  # Utilidades de salas y roles únicos (roomUtils.js)
│       ├── ws/                     # Servidor WS de partida (/game), seguridad y guardas de input
│       ├── signal.js               # Señalización WS de lobby (/signal) y transición a partida
│       └── index.js                # Punto de entrada unificado (Fastify + µWebSockets.js)
├── Frontend/
│   ├── public/assets/              # Sprites, escenarios y efectos de sonido del juego
│   └── src/
│       ├── components/             # Componentes globales de la web (Header, Modals, ProtectedRoute)
│       ├── game/                   # Motor y sesión del juego Danmakrew integrados en la SPA
│       │   ├── components/         # HUD táctico, overlays de arena, controles táctiles y flotantes
│       │   ├── engine/             # Renderizador PixiJS v7, etapas 1-3, balas, jefes y efectos
│       │   ├── network/            # Cliente WebSocket tipado (/game)
│       │   ├── session/            # Orquestación de partida, puente de workers y estado del escuadrón
│       │   └── workers/            # snapshot.worker.ts (interpolación) y gameSimulation.worker.ts (Planck.js)
│       ├── pages/                  # Home, Rooms, CreateRoom, CharacterSelection, Game (/game), Auth
│       ├── services/               # Clientes REST y WebSocket de lobby (api.js, wsClient.js)
│       └── styles/                 # Hojas de estilo modulares (incluye game.css con prefijo dk-*)
├── postman/                        # Colección de pruebas de API
├── docker-compose.yml              # Orquestación completa (Redis + Backend + Frontend)
└── package.json                    # Scripts raíz del workspace
```

---

## Flujo Lobby → Selección de Personaje → Partida (`/game`)

1. **Salas (`/rooms` / `/create-room`)**: Creación y unión a salas almacenadas en Redis y sincronizadas por `/signal`.
2. **Selección de Personaje (`/character-selection`)**:
   - Cada jugador elige un rol único entre `Tank`, `Support`, `DPS` y `Special_Attack` (sin duplicados en el escuadrón).
   - Cuando todos los jugadores marcan **LISTO**, el servidor marca la sala como `in_game` (preservando la sala en Redis durante el cambio de vista) y emite `game-start`.
3. **Partida (`/game`)**:
   - **Modo Online**: `GameWSClient` recibe snapshots del backend autoritativo (`GameRoom` + Planck.js) y los envía a `snapshot.worker.ts`, que interpola posiciones, proyectiles, muros, enemigos, ítems, jefe y *Beam Struggle* a 60 FPS fuera del hilo principal.
   - **Modo Offline / Demo (`demo-room-01`)**: Si el servidor WS no está disponible o se entra en sala de prueba, `GameWorkerBridge` levanta automáticamente `gameSimulation.worker.ts` con las **mismas físicas Planck.js** (muros de Tank de 25 HP / 1.0s TTL, auto-aim + curación de Support, ráfaga de DPS, Master Spark de 50 DPS de SP.ATK, choque de rayos *Beam Struggle* y jefe de 5 fases) conectado a `snapshot.worker.ts`.

---

## Ejecución con Docker Compose

### 1. Configurar variables de entorno

```bash
cp Backend/.env.example Backend/.env
```

### 2. Levantar todos los servicios

```bash
docker compose up --build
```

| Servicio | Puerto local | Descripción |
|----------|-------------|-------------|
| **redis** | `6379` | Redis Stack (salas efímeras) |
| **api** | `8080` | Backend HTTP REST (Fastify) |
| **api** | `9001` | Señalización `/signal` y servidor de juego `/game` (`µWebSockets.js`) |
| **frontend** | `3000` | Aplicación unificada React + PixiJS + Web Workers |

---

## Desarrollo Local (sin Docker)

Requisitos: Node.js 20+ y Redis corriendo en `127.0.0.1:6379` (para salas online; el modo demo funciona incluso sin backend).

```bash
# Instalar dependencias
npm --prefix ./Backend install
npm --prefix ./Frontend install

# Levantar Backend (:8080 / :9001) + Frontend (:3000) juntos en una sola terminal
npm run dev
```

Luego abrí **http://localhost:3000** en el navegador (el puerto `8080` es únicamente la API REST).

### Comandos de verificación desde la raíz

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia Backend + Frontend en simultáneo desde una sola terminal |
| `npm run dev:backend` | Inicia solo el backend en modo watch (`:8080` + `:9001`) |
| `npm run dev:frontend` | Inicia solo Vite en desarrollo (`http://localhost:3000`) |
| `npm run typecheck:frontend` | Verifica tipos TypeScript (`tsc --noEmit`) del motor, sesión y Web Workers |
| `npm run build:frontend` | Compila el bundle de producción de `Frontend/` (React + PixiJS + Workers + PWA) |
| `npm run test:physics` | Ejecuta la batería de pruebas de físicas Planck.js del backend |
