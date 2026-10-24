# Collab-Code Cloud Deployment Guide

This guide covers deploying **Collab-Code** to production cloud platforms.

---

## Architecture Overview

Collab-Code consists of:
1. **Frontend Client (`client/`)**: React 19 + TypeScript + Vite SPA. Can be hosted on **Vercel**, **Render Static Site**, or **Netlify**.
2. **Backend Server (`server/`)**: Node.js + Express + Socket.IO + WebRTC signaling. Requires a persistent Node process (e.g. **Render Web Service**, **Railway**, or **Fly.io**).
3. **Database**: **MongoDB Atlas** (Free M0 shared cluster) or local Mongo.
4. **Cache & Scaling Adapter**: **Upstash Redis** (free serverless Redis) or Railway Redis.
5. **Code Execution API**: Piston API (`https://emkc.org/api/v2/piston`) or self-hosted Judge0/Piston.

---

## Option 1: Render Blueprint (Recommended — 1-Click Setup)

The repository includes a ready-to-use [`render.yaml`](../render.yaml) blueprint that sets up both the Server and Client automatically.

### Steps:
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "chore: add cloud deployment configuration"
   git push origin main
   ```
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository `collab-code`.
5. Render detects `render.yaml` and provisions:
   - `collab-code-server`: Node Web Service (Free/Starter)
   - `collab-code-client`: Static Site (Free)
6. Under Environment Variables for `collab-code-server`, set:
   - `MONGODB_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `CLIENT_URL`: The URL of your deployed client (e.g. `https://collab-code-client.onrender.com`)
   - `REDIS_URL`: (Optional) Your Upstash Redis connection string
7. Trigger deployment. Once both services are live, visit the client URL!

---

## Option 2: Server on Render + Client on Vercel

If you prefer Vercel for high-speed edge delivery of the React frontend:

### Step 1: Deploy Backend to Render
1. Go to [Render Dashboard](https://dashboard.render.com) -> **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the service:
   - **Name**: `collab-code-server`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Add Environment Variables:
   | Variable | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production environment |
   | `PORT` | `10000` | Port automatically provided by Render |
   | `JWT_SECRET` | *(Generate a 32+ character random string)* | Secret for auth JWTs |
   | `JWT_EXPIRES_IN` | `7d` | Token lifetime |
   | `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster.mongodb.net/collab-code` | MongoDB Atlas URI |
   | `CLIENT_URL` | `https://<your-vercel-app>.vercel.app` | Vercel frontend URL for CORS |
   | `PISTON_URL` | `https://emkc.org/api/v2/piston` | Code execution endpoint |
   | `REDIS_URL` | `redis://...` *(optional)* | Upstash Redis URI |
5. Click **Create Web Service**. Note your server URL (e.g., `https://collab-code-server.onrender.com`).

---

### Step 2: Deploy Frontend to Vercel
1. Go to [Vercel Dashboard](https://vercel.com) -> **Add New...** -> **Project**.
2. Select your `collab-code` repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client` *(or leave root since `vercel.json` is configured)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In **Environment Variables**, add:
   | Variable | Value | Description |
   |---|---|---|
   | `VITE_API_URL` | `https://collab-code-server.onrender.com` | Render backend URL |
   | `VITE_SOCKET_URL` | `https://collab-code-server.onrender.com` | Socket.IO server URL |
5. Click **Deploy**. Vercel will build and assign your frontend URL (e.g. `https://collab-code.vercel.app`).
6. Update the `CLIENT_URL` variable in your Render Server settings with your live Vercel domain.

---

## Database Configuration (Free MongoDB Atlas)

1. Register at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Network Access**, add IP `0.0.0.0/0` (allow access from anywhere, required for dynamic PaaS IPs).
4. Under **Database Access**, create a database user with read/write privileges.
5. In **Clusters** -> **Connect** -> **Drivers**, copy the connection string:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/collab-code?retryWrites=true&w=majority
   ```
6. Set this as `MONGODB_URI` in your backend server environment.

---

## Post-Deployment Verification Checklist

- [ ] **Health Check**: Visit `https://<your-server-url>/health` — should return `{"status":"ok","uptime":...}`.
- [ ] **API Endpoint**: Visit `https://<your-server-url>/` — should return `{"name":"Collab Code API","status":"running",...}`.
- [ ] **Frontend Routing**: Navigate to `https://<your-client-url>/register`, test refreshing the page (ensures SPA rewrite works).
- [ ] **User Registration & Login**: Create a test account, check if JWT is stored in `localStorage`.
- [ ] **Collaborative Room & WebSockets**: Create a room, share the link or open an incognito window, verify that editor typing synchronizes in real time.
- [ ] **Code Execution**: Run code in Python or JavaScript, verify execution output from Piston API.
- [ ] **WebRTC Voice**: Join the voice lounge, allow microphone permissions, and verify audio connectivity across tabs/devices.
