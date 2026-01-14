# Clubwize

A professional social platform for community engagement and collaboration.

## Getting Started

### Prerequisites
- Node.js 22
- pnpm (client) / pnpm (backend)

### Installation & Run

```bash
# Backend
cd clubwize-backend
pnpm install
pnpm run dev          # runs on :4000

# Client
cd clubwize-client
pnpm install
pnpm dev             # runs on :3000
```

### Environment Variables

**Backend** (`clubwize-backend/.env`)
```
PORT=4000
NODE_ENV=development
MONGODB_URI=
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
```

**Client** (`clubwize-client/.env`)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_PROFANITY_URL=https://vector.profanity.dev
NEXT_PUBLIC_FIREBASE_APIKEY=your_firebase_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Tech Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Zod
- **Backend:** NestJS, TypeScript, MongoDB, Mongoose, WebSockets

## Core Concepts

| Term | Description |
|------|-------------|
| **Node** | A forum representing a real-world entity (e.g., an organization or institution) |
| **Club** | A purpose-driven community (e.g., Developers, Designers) |
| **Forum** | Collective term for both Nodes and Clubs |
| **Module** | A feature within a forum (e.g., Debates, Issues, Announcements) |
| **Asset** | A post or content item created within a module |
| **Clubsite** | A customizable landing page for organizations, featuring sections like Profile, Key Contacts, Products & Services, Jobs, Deals, and Resources |

## Client Folder Structure

```
CLIENT/
├── public/ (Static Assets)
├── src/
│   ├── app/
│   │   ├── (site)/         # Main app routes
│   │   │   ├── home/
│   │   │   ├── bookmarks/
│   │   │   ├── profile/
│   │   │   ├── club/[clubId]/
│   │   │   │   ├── [plugin]/[postId]/
│   │   │   │   ├── members/
│   │   │   │   ├── clubsite/
│   │   │   │   └── ...
│   │   │   └── node/[nodeSlug]/
│   │   │       ├── [plugin]/[postId]/
│   │   │       ├── chapters/[chapterId]/
│   │   │       ├── members/
│   │   │       ├── clubsite/
│   │   │       └── ...
│   │   └── admin/          # Admin panel
│   │       ├── assets/
│   │       ├── clubs/
│   │       ├── nodes/
│   │       ├── modules/
│   │       ├── domains/
│   │       ├── users/
│   │       └── reports/
│   ├── components/
│   │   ├── ui/             # Base UI (shadcn, custom)
│   │   ├── globals/        # Shared components (auth, comments, feed, forms)
│   │   ├── pages/          # Page-specific components
│   │   ├── plugins/        # Module components (debates, issues, projects)
│   │   └── admin/          # Admin components
│   ├── hooks/
│   │   └── apis/           # API hooks
│   ├── lib/
│   │   ├── config/
│   │   └── constants/
│   ├── store/              # Zustand state management
│   ├── utils/
│   │   ├── endpoints/      # API endpoint definitions
│   │   └── data/
│   ├── constants/
│   └── types/
└── ...
```

## Backend Folder Structure

```
BACKEND/
├── src/
│   ├── admin/                  # Admin APIs
│   │   ├── assets/
│   │   ├── configuration/
│   │   ├── dashboard/
│   │   ├── domain/
│   │   ├── forums/
│   │   ├── reports/
│   │   ├── std-plugins/
│   │   └── users/
│   ├── user/                   # User APIs
│   │   ├── auth/               # Authentication
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   ├── forgot-password/
│   │   │   ├── change-password/
│   │   │   ├── google-signin/
│   │   │   └── google-signup/
│   │   ├── node/
│   │   ├── club/
│   │   ├── chapter/
│   │   ├── bookmarks/
│   │   ├── comment/
│   │   ├── generic-post/
│   │   ├── invitation/
│   │   ├── report/
│   │   ├── standard-assets/
│   │   └── guards/          # Auth guards (club, node)
│   ├── plugin/              # Module implementations (NOTE: Module is refered as Plugin, due to keyword issue)
│   │   ├── debate/
│   │   ├── issues/
│   │   ├── project/
│   │   ├── rules-regulations/
│   │   ├── lets-talk/
│   │   └── strategic-needs/
│   ├── shared/                 # Shared resources
│   │   ├── entities/           # Mongoose schemas
│   │   ├── exceptions/
│   │   ├── middleware/
│   │   ├── pipes/
│   │   ├── search/
│   │   ├── types/
│   │   └── upload/
│   ├── socket/                 # WebSocket handlers
│   ├── chat/
│   ├── notification/
│   ├── mailer/
│   ├── decorators/
│   ├── utils/
│   └── types/
```


