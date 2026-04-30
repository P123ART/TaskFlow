# ⚡ TaskFlow — Team Task Manager

A full-stack web application for managing team projects and tasks with **role-based access control** (Admin/Member).

---

## 🚀 Features

- **Authentication** — JWT-based signup/login with role selection (Admin/Member)
- **Project Management** — Admins can create, update, delete projects
- **Team Management** — Add/remove project members, assign roles
- **Task Management** — Create tasks with title, description, status, priority, due date, assignee
- **Role-Based Access Control:**
  - **Admin**: Create projects, manage all tasks, add/remove members
  - **Member**: View tasks, update status on assigned tasks only
- **Dashboard** — Personal stats, recent activity, project overview
- **Progress Tracking** — Per-project progress bar, overdue detection, status filters
- **REST API** — Clean, validated endpoints with proper HTTP status codes

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, Axios, Vite |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| Auth | JWT + bcryptjs |
| Deployment | Railway |

---

## 📁 Project Structure

```
team-task-manager/
├── backend/
│   ├── models/
│   │   └── db.js          # SQLite schema + connection
│   ├── middleware/
│   │   └── auth.js        # JWT auth + role guards
│   ├── routes/
│   │   ├── auth.js        # POST /signup, /login, GET /me
│   │   ├── projects.js    # CRUD projects + members
│   │   ├── tasks.js       # CRUD tasks + dashboard
│   │   └── users.js       # User management
│   ├── server.js          # Express app entry point
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Projects.jsx
│   │   │   └── ProjectDetail.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── railway.toml
├── nixpacks.toml
└── README.md
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js 18+
- npm

### Step 1 — Clone & Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/team-task-manager.git
cd team-task-manager

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2 — Configure Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and set your JWT_SECRET

# Frontend (optional for local dev — Vite proxy handles it)
cd ../frontend
cp .env.example .env
```

### Step 3 — Run Development Servers

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# App opens on http://localhost:5173
```

### Step 4 — Open the App

Visit `http://localhost:5173` and create an account.

> **Tip:** Register as **Admin** first to create projects. Then register other accounts as **Member** to test role-based access.

---

## 🗄️ Database Schema

```sql
users        — id, name, email, password, role (admin|member)
projects     — id, name, description, owner_id
project_members — project_id, user_id, role (admin|member)
tasks        — id, title, description, status, priority, due_date,
               project_id, assignee_id, created_by
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |

### Projects
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/api/projects` | List user's projects | All |
| POST | `/api/projects` | Create project | Admin |
| GET | `/api/projects/:id` | Get project details | Member+ |
| PUT | `/api/projects/:id` | Update project | Project Admin |
| DELETE | `/api/projects/:id` | Delete project | Project Admin |
| POST | `/api/projects/:id/members` | Add member | Project Admin |
| DELETE | `/api/projects/:id/members/:userId` | Remove member | Project Admin |
| GET | `/api/projects/:id/stats` | Task statistics | Member+ |

### Tasks
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/api/tasks` | List tasks (filter by project) | All |
| POST | `/api/tasks` | Create task | Project Admin |
| PUT | `/api/tasks/:id` | Update task | Admin (all fields) / Assignee (status only) |
| DELETE | `/api/tasks/:id` | Delete task | Project Admin |
| GET | `/api/tasks/dashboard/summary` | Dashboard stats | All |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| PUT | `/api/users/:id/role` | Update user role (Admin only) |

---

## 🚂 Deployment on Railway

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Team Task Manager"
git remote add origin https://github.com/YOUR_USERNAME/team-task-manager.git
git push -u origin main
```

### Step 2 — Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js via `nixpacks.toml`

### Step 3 — Set Environment Variables

In Railway project settings → **Variables**, add:

```
PORT=5000
NODE_ENV=production
JWT_SECRET=your_very_long_random_secret_key_here
```

### Step 4 — Generate Domain

In Railway → **Settings** → **Networking** → **Generate Domain**

Your app will be live at: `https://your-app-name.up.railway.app`

---

## 🔑 Role Permissions Summary

| Action | Admin | Member |
|--------|-------|--------|
| Create projects | ✅ | ❌ |
| Edit/delete projects | ✅ | ❌ |
| Add/remove members | ✅ | ❌ |
| Create tasks | ✅ | ❌ |
| Edit all task fields | ✅ | ❌ |
| Update own task status | ✅ | ✅ |
| View projects/tasks | ✅ | ✅ |

---

## 📹 Demo Video Guide (2–5 min)

Suggested flow for your demo video:
1. Show signup as **Admin** → create a project
2. Add tasks with different priorities and due dates
3. Signup as **Member** → show limited access (can only update status)
4. Admin adds Member to project → Member can now see it
5. Show Dashboard with stats
6. Show live deployment URL working

---

## 📬 Submission Checklist

- [ ] Live URL (Railway deployment)
- [ ] GitHub repo (public)
- [ ] This README
- [ ] 2–5 min demo video

---

## 🧑‍💻 Author

Built as a full-stack assessment project demonstrating:
- RESTful API design with Express.js
- JWT authentication & role-based access control
- React SPA with client-side routing
- SQLite relational database with proper foreign keys
- Production deployment on Railway
