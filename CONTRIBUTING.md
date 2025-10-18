# Contributing to Letters

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js 18+** (for native fetch support)
- **npm 8+**
- A Buttondown account with API access

### Initial Setup

1. **Clone and install**:

   ```bash
   git clone <repository-url>
   cd letters
   npm install
   ```

2. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env and add your BUTTONDOWN_API_KEY
   ```

3. **Run initial sync** (optional, to populate database):
   ```bash
   npm run sync
   ```

## Project Structure

```
letters/
├── lib/                    # Shared core libraries
│   ├── db/                 # Database layer
│   │   ├── queries/        # Domain-specific query classes
│   │   └── schema.ts       # Database initialization
│   ├── api/                # API client
│   └── utils/              # Utilities
├── apps/                   # Independent applications
│   ├── sync/               # Newsletter sync CLI
│   └── reader/             # Web reader app
├── scripts/                # Utility scripts
└── docs/                   # Documentation
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture documentation.

## Development Workflow

### Making Changes

1. **Create a branch**:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:

   ```bash
   npm run type-check
   ```

4. **Commit with descriptive messages**:

   ```bash
   git commit -m "feat: add image compression feature"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):

   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

### Running the App

```bash
# Type checking
npm run type-check

# Run sync
npm run sync
npm run reader

# Run specific scripts
npm run images:analyze
npm run images:compress
```

## Code Style

### TypeScript

- Use **strict mode** (already configured)
- Prefer **explicit types** over `any`
- Use **interfaces** for public APIs
- Add **JSDoc comments** for public functions

### File Organization

- **Imports**: Use `.js` extension for ESM compatibility

  ```typescript
  import { logger } from '../utils/logger.js';
  ```

- **Relative paths**: Use appropriate depth

  ```typescript
  // From apps/
  import { initializeDatabase } from '../../lib/db/schema.js';

  // From scripts/
  import { initializeDatabase } from '../lib/db/schema.js';
  ```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`

### Database Queries

- Always use `DatabaseQueries` class, don't write raw SQL in apps
- Use domain-specific query methods (`queries.emails.*`, `queries.images.*`, etc.)
- Use transactions for multiple writes
- Always close database in `finally` blocks

```typescript
const db = initializeDatabase();
const queries = new DatabaseQueries(db);

try {
  queries.transaction(() => {
    queries.emails.upsertEmail(email);
    queries.attachments.linkEmailAttachment(emailId, attachmentId);
  });
} finally {
  db.close();
}
```

## Creating New Apps

See [apps/\_template/README.md](./apps/_template/README.md) for a complete guide.

**Quick start**:

```bash
# 1. Copy template
cp -r apps/_template apps/my-app

# 2. Implement logic in apps/my-app/index.ts

# 3. Add script to package.json
"my-app": "tsx apps/my-app/index.ts"

# 4. Run it
npm run my-app
```

## Adding Dependencies

- **Shared dependencies**: Add to root `package.json`

```bash
# Shared dependency
npm install library-name

# Dev dependency
npm install -D library-name
```

## Documentation

When adding new features:

1. **Update README.md** if it affects user-facing features
2. **Update ARCHITECTURE.md** if it changes system design
3. **Add JSDoc comments** to all public APIs
4. **Create examples** for complex features

## Testing

### Manual Testing

1. **Sync test**:

   ```bash
   npm run sync:status
   npm run sync -- --dry-run
   ```

2. **Reader test**:

   ```bash
   npm run reader
   # Open http://localhost:3000
   ```

3. **Database test**:
   ```bash
   sqlite3 data/newsletters.db "SELECT COUNT(*) FROM emails;"
   ```

## Pull Request Process

1. **Ensure tests pass** and there are no linting errors
2. **Update documentation** as needed
3. **Write descriptive PR description**:
   - What changed and why
   - How to test the changes
   - Any breaking changes
4. **Link related issues**
5. **Request review**

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Commit messages follow conventions

## Getting Help

- **Architecture questions**: Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Issues**: Open a GitHub issue
- **Questions**: Start a discussion

## Common Tasks

### Reset database (for testing)

```bash
npm run db:reset
npm run sync
```

### Export single email

```bash
npm run export:email <email-id> output.html
```

### Analyze database size

```bash
npm run db:analyze
npm run images:analyze
```

### Compress images

```bash
npm run images:compress
```

## Code Organization

The codebase is organized into domain-specific modules:

### Database Queries

Queries are split by domain:

```typescript
// Email operations
queries.emails.upsertEmail(email);
queries.emails.getAllEmails();

// Image operations
queries.images.storeEmbeddedImage(emailId, image);
queries.images.getEmbeddedImages(emailId);

// Attachment operations
queries.attachments.upsertAttachment(attachment);
queries.attachments.linkEmailAttachment(emailId, attachmentId);

// Metadata operations
queries.metadata.getLastSyncDate();
queries.metadata.updateSyncMetadata(key, value);
```

### Key Utilities

- **Logger**: `lib/utils/logger.ts` - Structured logging with levels
- **Markdown normalizer**: `lib/utils/markdown-normalizer.ts` - HTML to markdown conversion
- **Image processor**: `lib/utils/image-processor.ts` - Image download and processing

## License

By contributing, you agree that your contributions will be licensed under the project's ISC License.

---

**Questions?** Open an issue or start a discussion. We're here to help!
