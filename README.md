# Proyecto-Integrador — Danmakrew

Éste es el repositorio en el que trabaja la empresa NoMercyGames.

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.
- [ngrok](https://ngrok.com/download) instalado y con cuenta gratuita configurada (`ngrok config add-authtoken TU_TOKEN`).

---

## Levantar el proyecto con Docker

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/Proyecto-Integrador.git
cd Proyecto-Integrador
```

### 2. Levantar todos los servicios

```bash
docker compose up --build
```

Esto levanta:

| Servicio   | Puerto local | Descripción                  |
|------------|-------------|------------------------------|
| **db**     | 5432        | PostgreSQL 16                |
| **api**    | 5000        | Backend Node.js (Express)    |
| **frontend** | 3000     | Frontend React (Vite dev)    |

Esperá a ver en la terminal:
```
Servidor corriendo en http://localhost:8080
Tablas sincronizadas.
```

### 3. Verificar que funciona localmente

- **Frontend:** http://localhost:3000
- **API:** http://localhost:5000/api/users
- **Swagger:** http://localhost:5000/swagger

---

## Exponer con ngrok (acceso público)

### Opción A: Exponer solo el backend (API)

```bash
ngrok http 5000
```

Esto te da una URL pública como `https://xxxx-xxx.ngrok-free.app`. Podés usarla para probar la API desde Postman o desde otro dispositivo.

### Opción B: Exponer el frontend + backend juntos

Para esto necesitás servir el frontend como estático desde el backend (el proyecto ya lo soporta).

#### Paso 1: Hacer build del frontend

```bash
cd Frontend
npm install
npm run build
cd ..
```

Esto genera la carpeta `Frontend/dist/`.

#### Paso 2: Levantar el backend (que sirve el frontend estático)

Pará los contenedores de Docker y levantá solo la base de datos:

```bash
docker compose up db
```

En otra terminal, levantá el backend:

```bash
cd Backend
npm install
npm run dev
```

El backend sirve el frontend desde `Frontend/dist/` y la API desde `/api`.

#### Paso 3: Exponer con ngrok

```bash
ngrok http 8080
```

La URL pública de ngrok tendrá todo: frontend + API + Swagger.

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
