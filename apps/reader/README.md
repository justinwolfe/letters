# Newsletter Reader

A React-based single page application for reading newsletters chronologically. Provides seamless navigation between issues based on publish date.

## Features

- **Browse All Issues**: View all published newsletters in a clean, card-based layout
- **Single Page Navigation**: Seamlessly navigate between issues without page reloads
- **Chronological Ordering**: Issues sorted by publish date (newest first)
- **Previous/Next Navigation**: Easily move between consecutive issues
- **Embedded Images**: All images are loaded from the local database as data URIs
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices
- **Modern UI**: Clean, readable interface optimized for long-form content

## Quick Start

### Development Mode

Run the backend API server and frontend dev server separately:

1. **Start the API server** (in one terminal):

   ```bash
   npm run reader:server
   ```

   This starts the Express server on port 3000.

2. **Start the frontend dev server** (in another terminal):

   ```bash
   npm run reader:dev
   ```

   This starts Vite dev server on port 5173 with hot module replacement.

3. **Open your browser** to `http://localhost:5173`

### Production Mode

Build and run the optimized production version:

1. **Build the frontend**:

   ```bash
   npm run reader:build
   ```

2. **Start the production server**:

   ```bash
   npm run reader
   ```

3. **Open your browser** to `http://localhost:3000`

## Usage

### Browsing Issues

The home page displays all published newsletters in a grid of cards. Each card shows:

- Newsletter subject/title
- Description (if available)
- Featured image (if available)
- Publish date

Click any card to open that issue in the reader.

### Reading an Issue

The reader view shows:

- Full newsletter content with embedded images
- Navigation buttons at top and bottom
- "Back to List" button to return to the overview
- "Previous" and "Next" buttons to navigate between issues chronologically

### Keyboard Navigation

While viewing an issue, you can use keyboard shortcuts:

- Press `Esc` or click "Back to List" to return to the overview
- Use Previous/Next buttons to navigate chronologically

## API Endpoints

The backend provides three REST API endpoints:

### GET /api/emails

Returns all published emails with basic metadata:

```json
[
  {
    "id": "abc123",
    "subject": "Newsletter Title",
    "description": "Brief description",
    "publish_date": "2024-01-15T12:00:00Z",
    "slug": "newsletter-title",
    "image_url": "https://example.com/image.jpg"
  }
]
```

### GET /api/emails/:id

Returns a single email with full content:

```json
{
  "id": "abc123",
  "subject": "Newsletter Title",
  "body": "<html>Full email content with embedded images as data URIs</html>",
  "publish_date": "2024-01-15T12:00:00Z",
  "description": "Brief description"
}
```

### GET /api/emails/:id/navigation

Returns navigation links for an email:

```json
{
  "prev": {
    "id": "def456",
    "subject": "Previous Newsletter",
    "publish_date": "2024-01-10T12:00:00Z"
  },
  "next": {
    "id": "ghi789",
    "subject": "Next Newsletter",
    "publish_date": "2024-01-20T12:00:00Z"
  }
}
```

## Configuration

### Port Configuration

By default:

- Backend API runs on port 3000
- Vite dev server runs on port 5173

To change the API port:

```bash
npm run reader -- --port=8080
```

Or set the `PORT` environment variable:

```bash
PORT=8080 npm run reader
```

### Environment Variables

Create a `.env` file if you need custom configuration:

```bash
# API server port
PORT=3000

# For production builds, set the API base URL
VITE_API_BASE=http://localhost:3000
```

## Architecture

### Frontend (React + Vite)

- **React 18**: Modern React with hooks
- **Vite**: Fast dev server and optimized production builds
- **TypeScript**: Type-safe component development
- **CSS**: Custom responsive styles, no framework dependencies

### Backend (Express + SQLite)

- **Express**: Lightweight web server
- **better-sqlite3**: Direct database access
- **CORS enabled**: For development mode
- **Static file serving**: Serves built React app in production

### Data Flow

1. Frontend makes API request to `/api/emails`
2. Backend queries SQLite database
3. For individual emails, backend converts embedded images to data URIs
4. JSON response sent to frontend
5. React renders the content

## File Structure

```
apps/reader/
├── index.ts              # Express server & API endpoints
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── src/
│   ├── App.tsx           # Main React component
│   ├── App.css           # Styles
│   └── main.tsx          # React DOM entry
├── dist/                 # Built frontend (generated)
└── README.md             # This file
```

## Development Tips

### Hot Reload

In development mode, the frontend updates instantly when you save changes to React components. The backend needs to be restarted if you modify `index.ts`.

### Debugging

Enable verbose logging:

```bash
npm run reader:server -- --verbose
```

### Testing API Endpoints

Use curl or your browser:

```bash
# List all emails
curl http://localhost:3000/api/emails

# Get specific email
curl http://localhost:3000/api/emails/YOUR_EMAIL_ID

# Get navigation
curl http://localhost:3000/api/emails/YOUR_EMAIL_ID/navigation
```

## Troubleshooting

### "No emails found"

Make sure you've synced your newsletters first:

```bash
npm run sync
```

### Port already in use

Change the port:

```bash
npm run reader -- --port=3001
```

### Images not loading

The app uses embedded images from the database. Ensure images were downloaded during sync:

```bash
npm run images:download
```

## Future Enhancements

Potential features to add:

- Search functionality
- Filter by date range
- Dark mode toggle
- Email sharing
- Print-friendly view
- Offline support with service worker
- URL routing for deep linking
- Archive by month/year view
- Tags/categories if available in data
- Export to PDF

## Technical Details

### Why Data URIs?

Images are stored in the SQLite database as blobs and converted to data URIs. This approach:

- ✅ Works offline
- ✅ No external image hosting needed
- ✅ Fast loading (no network requests)
- ✅ Portable (single database file)
- ⚠️ Increases HTML payload size

### Performance Considerations

- Images are only loaded when viewing individual emails
- List view only fetches metadata (no body content)
- SQLite indexes on publish_date for fast sorting
- React key optimization prevents unnecessary re-renders

### Security Notes

- HTML content is rendered with `dangerouslySetInnerHTML`
- Content comes from your own database (trusted source)
- No user-generated content
- CORS enabled for development only

## Contributing

This app follows the `letters` app template structure. To modify:

1. Backend changes: Edit `apps/reader/index.ts`
2. Frontend changes: Edit files in `apps/reader/src/`
3. Rebuild after changes: `npm run reader:build`

## License

Same as the main `letters` project.
