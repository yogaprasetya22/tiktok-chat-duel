# 🎥 TikTok Live Chat - Next.js Monolithic

**Next.js 16 + TypeScript + Bun + Tailwind CSS**

A full-stack Next.js application for real-time TikTok Live Chat monitoring with backend API routes and frontend React components in a single monolithic project.

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────┐
│      Next.js App (Monolithic)           │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │  /app/page.tsx   │  │  Components │ │
│  │  (Frontend)      │  │  & Hooks    │ │
│  └──────────────────┘  └─────────────┘ │
│           ▲                    ▲        │
│           │                    │        │
│           └────────┬───────────┘        │
│                    │                   │
│  ┌─────────────────▼─────────────────┐ │
│  │   /app/api/tiktok/* (Backend)     │ │
│  │   - /connect                       │ │
│  │   - /disconnect                    │ │
│  │   - /status                        │ │
│  └─────────────────┬─────────────────┘ │
│                    │                   │
│  ┌─────────────────▼─────────────────┐ │
│  │   /lib/server/tiktok.ts           │ │
│  │   - TikTokLiveService (singleton) │ │
│  │   - Event handling                 │ │
│  └─────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
         ▼
    TikTok Live API
```

---

## 📂 **Project Structure**

```
tiktok-next/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (uses TikTokLiveChat)
│   ├── api/
│   │   └── tiktok/             # Backend API routes
│   │       ├── connect/
│   │       │   └── route.ts    # POST /api/tiktok/connect
│   │       ├── disconnect/
│   │       │   └── route.ts    # POST /api/tiktok/disconnect
│   │       └── status/
│   │           └── route.ts    # GET /api/tiktok/status
│   └── globals.css
│
├── lib/
│   ├── hooks.ts                # useTikTokLive hook
│   └── server/
│       └── tiktok.ts           # Backend service (Node.js)
│
├── components/
│   └── TikTokLiveChat.tsx      # Main chat component
│
├── .env.local                  # Environment variables
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

---

## 🚀 **Getting Started**

### **1. Prerequisites**
- Node.js 18+ (or use system Node)
- Bun 1.0+
- TikTool API Key

### **2. Environment Setup**

`.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
VITE_TIKTOK_API_KEY=your_api_key_here
```

### **3. Install Dependencies**

```bash
cd tiktok-next
bun install
```

### **4. Run Development Server**

```bash
bun run dev
```

Server starts at: **http://localhost:3000**

### **5. Build for Production**

```bash
bun run build
bun run start
```

---

## 🎯 **API Endpoints**

### **Connect to TikTok Live**
```bash
POST /api/tiktok/connect
Content-Type: application/json

{
  "username": "tiktok_username"
}

Response:
{
  "success": true,
  "message": "Connected to @tiktok_username"
}
```

### **Disconnect**
```bash
POST /api/tiktok/disconnect

Response:
{
  "success": true,
  "message": "Disconnected from TikTok Live"
}
```

### **Get Status**
```bash
GET /api/tiktok/status

Response:
{
  "connected": true,
  "username": "tiktok_username"
}
```

---

## 🎨 **Features**

- ✅ **Monolithic Architecture** - Backend API routes + Frontend in one app
- ✅ **TypeScript** - Full type safety
- ✅ **Tailwind CSS** - Modern styling
- ✅ **Real-time Chat** - Instant message updates
- ✅ **Gift Detection** - Emoji alerts for gifts
- ✅ **Like Tracking** - Like counter
- ✅ **Follow Notifications** - Follow alerts
- ✅ **Error Handling** - Comprehensive error management
- ✅ **Efficient** - Bun package manager

---

## 🧠 **Three.js Integration (Next Steps)**

Ready for 3D visualization! Add Three.js with:

```bash
bun add three @types/three
```

### **Example Structure**:
```
components/
├── TikTokLiveChat.tsx
├── Canvas3D.tsx          # Three.js canvas
└── Visualizer.tsx        # 3D visualizer for chat
```

### **Use Case Ideas**:
1. **Chat Particles** - Messages spawn as 3D particles
2. **Gift Explosions** - 3D animation for gifts
3. **User Avatars** - 3D models for chat users
4. **Leaderboard Scene** - 3D ranked display

---

## 📋 **npm Scripts**

| Script | Description |
|--------|-------------|
| `bun run dev` | Start dev server (hot reload) |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |

---

## 🔐 **Security Notes**

- ✅ API Key stored in backend only (`.env.local`)
- ✅ No API Key exposed to frontend
- ✅ Next.js API routes handle all TikTok communication
- ✅ Frontend consumes only required data

---

## 🐛 **Troubleshooting**

### **Port Already in Use**
```bash
# Change port in package.json scripts:
"dev": "next dev -p 3001"
```

### **Dependencies Not Found**
```bash
bun install
bun run build
```

### **API Connection Error**
- Check `.env.local` has `VITE_TIKTOK_API_KEY`
- Verify TikTok username is correct
- Check if user is currently live

---

## 📚 **Next Steps**

1. **Add Database** - MongoDB/PostgreSQL integration
2. **Three.js Visualization** - 3D chat animation
3. **WebSocket Real-time** - Server-Sent Events (SSE)
4. **Authentication** - User accounts & permissions
5. **Analytics** - Chat statistics & leaderboards

---

## 📄 **License**

MIT

---

## 💡 **Tips**

- Use `"use client"` for React components with hooks
- Use `"use server"` for server actions
- Backend logic in `/lib/server/` remains Node.js only
- Frontend logic in `/lib/hooks.ts` and `/components/`

Dibuat dengan ❤️ menggunakan Next.js + TypeScript + Bun
