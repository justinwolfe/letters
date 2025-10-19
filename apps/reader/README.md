# Newsletter Reader App

A React-based single page application for reading newsletters chronologically, with a clean separation between frontend and backend.

## Architecture

The reader app is now organized with a clear separation of concerns:

```
apps/reader/
├── server/                 # Backend (Express API)
│   ├── index.ts           # Server entry point
│   ├── routes/            # API route handlers
│   │   ├── emails.ts      # Email endpoints
│   │   └── images.ts      # Image serving
│   └── middleware/        # Express middleware
│       ├── error.ts       # Error handling
│       └── logging.ts     # Request logging
├── client/                # Frontend (React + Vite)
│   ├── src/
│   │   ├── App.tsx       # Main React app
│   │   ├── App.css       # Styles
│   │   └── main.tsx      # React entry point
│   ├── dist/             # Built frontend (served by server)
│   ├── index.html        # HTML template
│   ├── vite.config.ts    # Vite configuration
│   └── tsconfig.json     # TypeScript config for client
└── README.md             # This file
```

## Development

### Run Both Frontend and Backend (Recommended)

```bash
npm run dev
```

This starts:

- **Backend server** on port 3000 (API + serving built frontend)
- **Vite dev server** on port 5173 (hot reload for development)

The Vite dev server proxies API requests to the backend server.

### Run Backend Only

```bash
npm run reader:server
```

Starts the Express server on port 3000. Serves the pre-built frontend from `client/dist`.

### Run Frontend Dev Server Only

```bash
npm run reader:dev
```

Starts the Vite dev server on port 5173. Requires the backend server to be running separately for API requests.

### Build Frontend

```bash
npm run reader:build
```

Builds the React app for production into `client/dist/`.

### Production Mode

```bash
npm run reader
```

Builds the frontend and starts the server. Serves the optimized production build.

## API Endpoints

### Emails

- `GET /api/emails` - List all published emails
- `GET /api/emails/search?q=query` - Search emails
- `GET /api/emails/random` - Get a random email
- `GET /api/emails/:id` - Get email by ID with full content
- `GET /api/emails/:id/navigation` - Get prev/next email links

### Images

- `GET /api/images/:id` - Get embedded image by ID

### Health

- `GET /health` - Server health check

## Features

### Frontend (React)

- Browse all published newsletters
- Full-text search with snippet highlighting
- Multiple sorting options (date, subject)
- Random newsletter button
- Chronological navigation (prev/next)
- Mobile-friendly with swipe gestures
- Remembers last viewed newsletter
- Responsive design

### Backend (Express)

- RESTful API for newsletter data
- Image serving from database BLOBs
- Request logging middleware
- Error handling middleware
- CORS enabled for development
- Database query abstraction

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### Vite Proxy

The Vite dev server is configured to proxy `/api` requests to `http://127.0.0.1:3000`.

See `client/vite.config.ts` to modify proxy settings.

## Notes

### Why This Structure?

The separation provides several benefits:

1. **Clear responsibilities** - Server handles data, client handles presentation
2. **Independent deployment** - Frontend can be deployed to CDN, backend to server
3. **Development flexibility** - Work on frontend/backend independently
4. **Code organization** - Related code grouped together
5. **Scalability** - Easy to add new routes, middleware, or components

### Build Output

The frontend build outputs to `apps/reader/client/dist/`, and the server serves this directory in production. In development, Vite serves the frontend with hot reload.

### TypeScript

Both client and server have their own TypeScript configurations:

- `client/tsconfig.json` - Frontend config (React, DOM types)
- Server uses root `tsconfig.json` - Backend config (Node types)

## Troubleshooting

### Port Already in Use

```bash
npm run kill-ports
```

Kills processes on ports 3000 and 5173.

### Build Fails

Make sure you're in the correct directory:

```bash
cd apps/reader/client
npm install  # If needed
vite build
```

### API Requests Fail

1. Check that backend server is running on port 3000
2. Verify Vite proxy configuration in `client/vite.config.ts`
3. Check CORS settings in `server/index.ts`

## Future Improvements

Potential enhancements as outlined in the refactoring roadmap:

- [ ] Add shared API client package for type-safe requests
- [ ] Implement event system for real-time updates
- [ ] Add full-text search with FTS5
- [ ] Implement caching layer
- [ ] Add authentication middleware
- [ ] Create admin interface
