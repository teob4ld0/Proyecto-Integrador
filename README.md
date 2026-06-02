# Proyecto-Integrador — Danmakrew

Éste es el repositorio en el que trabaja la empresa NoMercyGames.

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.
- [ngrok](https://ngrok.com/download) instalado y con cuenta gratuita configurada (`ngrok config add-authtoken TU_TOKEN`).

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework HTTP | Fastify v4 |
| Base de datos de usuarios | SQLite (via better-sqlite3 + Lucia) |
| Sesiones de salas efímeras | Redis Stack (ioredis) |
| Señalización WebSocket | µWebSockets.js |
| Validación de esquemas | Zod |
| Frontend | React + Vite |

---

## Levantar el proyecto con Docker

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/Proyecto-Integrador.git
cd Proyecto-Integrador
```

### 2. Configurar variables de entorno

```bash
cp Backend/.env.example Backend/.env
# Editar Backend/.env con tus valores reales
```

### 3. Levantar todos los servicios

```bash
docker compose up --build
```

Esto levanta:

| Servicio     | Puerto local | Descripción                              |
|--------------|-------------|------------------------------------------|
| **redis**    | 6379        | Redis Stack (salas efímeras)             |
| **api**      | 8080        | Backend Node.js (Fastify HTTP)           |
| **api**      | 9001        | Servidor de señalización WebSocket       |
| **frontend** | 3000        | Frontend React (Vite dev)                |

Esperá a ver en la terminal:
```
[Redis] Connected
Servidor corriendo en http://localhost:8080
[Signal] WebSocket signaling server listening on port 9001
```

### 4. Verificar que funciona localmente

- **Frontend:** http://localhost:3000
- **API REST:** http://localhost:8080/api
- **WebSocket señalización:** ws://localhost:9001/signal?token=TU_SESSION_ID

---

## API de Salas

### `POST /api/rooms` — Crear sala (requiere autenticación)

```json
{
  "name": "Mi sala",
  "map": "classic",
  "maxPlayers": 8,
  "password": "opcional",
  "isPublic": true
}
```

Respuesta `201`:
```json
{
  "id": "uuid",
  "name": "Mi sala",
  "hostId": "uuid-del-host",
  "map": "classic",
  "maxPlayers": 8,
  "players": 1,
  "hasPassword": false,
  "isPublic": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

Las salas tienen TTL de **2 horas** en Redis.

### `GET /api/rooms` — Listar salas públicas

Devuelve las 50 salas públicas más recientes sin contraseña.

### `DELETE /api/rooms/:roomId` — Eliminar sala (solo el host)

---

## Protocolo WebSocket de señalización

Conectar a `ws://localhost:9001/signal?token=<session_id>`.

### Mensajes cliente → servidor

| `type` | Campos adicionales | Descripción |
|---|---|---|
| `host-room` | `roomId` | El host registra la sala (debe existir en Redis) |
| `join-room` | `roomId` | Un jugador solicita unirse |
| `ping` | — | Heartbeat (enviar cada ~30s) |

### Mensajes servidor → cliente

| `type` | Descripción |
|---|---|
| `room-hosted` | Confirmación de sala registrada |
| `room-joined` | Confirmación de unión |
| `player-join-request` | Llega al host cuando un jugador se une (incluye `userId`) |
| `host-disconnected` | Llega a los jugadores cuando el host se desconecta |
| `pong` | Respuesta al ping |
| `error` | Error de protocolo (incluye `message`) |

---

## Exponer con ngrok (acceso público)

### Exponer solo el backend (API + WS)

```bash
# HTTP API
ngrok http 8080

# WebSocket (en otra terminal o con un tunnel config file)
ngrok http 9001
```

### Con archivo de configuración ngrok (recomendado)

```yaml
# ngrok.yml
tunnels:
  api:
    proto: http
    addr: 8080
  ws:
    proto: http
    addr: 9001
```

```bash
ngrok start --all --config ngrok.yml
```

Actualizá `FRONTEND_URL` en `Backend/.env` con la URL de ngrok del API.

---

## Variables de entorno

El backend usa un archivo `Backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proyectodb
DB_USER=postgres
DB_PASSWORD=postgres

JWT_KEY=UnaClaveSecretaMuyLargaYSeguraParaJWT_12345!
JWT_ISSUER=DanmakrewAPI
JWT_AUDIENCE=DanmakrewUsers

PORT=8080
```

> **Nota:** Con Docker Compose las variables se inyectan automáticamente desde `docker-compose.yml`. El `.env` es para ejecución local sin Docker.

---

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose up --build` | Levantar todo (rebuild) |
| `docker compose up db` | Solo la base de datos |
| `docker compose down` | Parar todos los servicios |
| `docker compose down -v` | Parar y borrar volúmenes (resetea la DB) |
| `docker compose logs api` | Ver logs del backend |
