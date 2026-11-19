<p align="center">
  <img src="assets/oia-logo.svg" alt="OIA – Overthinker Image AI" width="420" />
</p>

<p align="center">
  <a href="../README.md">🏠 Home</a> · <a href="LOCAL-EDITION.md">💻 Local Edition</a> · <a href="CLOUD-EDITION.md">☁️ Cloud Edition</a> · <a href="TROUBLESHOOTING.md">🔧 Troubleshooting</a>
</p>

---

# Installation Guide — OIA – Overthinker Image AI

## Prerequisites
- **Node.js**: `>= 18.17.0`
- **npm**: `>= 9.x`
- **Optional**: `ffmpeg` (for MP4/WebM video rendering), Ollama / LM Studio / ComfyUI (for local AI)

## Step-by-Step Setup
1. Clone the repository and enter the project directory:
   ```bash
   git clone <repository-url>
   cd overthinker-image-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example apps/api/.env
   ```
4. Initialize the SQLite database and Prisma Client:
   ```bash
   npm run db:generate
   cd apps/api && npx prisma migrate deploy && cd ../..
   ```
5. Build and verify tests:
   ```bash
   npm run build --workspace=apps/api
   npm run test --workspace=apps/api
   ```
6. Start the application:
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:4000/api/v1/health`
