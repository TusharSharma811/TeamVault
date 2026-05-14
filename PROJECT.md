# TeamVault Project Documentation

TeamVault is a secure team file vault for organizations that store files in cloud object storage. The app lets users connect AWS S3 or Google Cloud Storage buckets, upload files, grant teammate access, generate signed URLs, and create expiring public share links.

## Current Status

The project is now a complete MVP with:

- A TypeScript Express API.
- MongoDB persistence through Mongoose.
- JWT authentication.
- Encrypted cloud storage credentials.
- AWS S3 and Google Cloud Storage upload/download support.
- Multi-file and folder uploads with a 5GB upload cap.
- Per-connection and per-file user whitelists.
- Public expiring share links.
- Structured backend request/error logging for debugging.
- A product landing page plus a modern React dashboard for auth, storage setup, uploads, access, and sharing.

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS runtime import
- Axios
- CSS modules through plain `App.css` and `index.css`

### Backend

- Node.js
- Express
- TypeScript
- MongoDB with Mongoose
- JWT for auth
- bcrypt for password hashing
- Zod for request validation
- Multer for file uploads
- AWS SDK v3
- Google Cloud Storage SDK
- AES-256-GCM for credential encryption

## Main User Flow

1. A user creates an account or signs in.
2. The user creates a storage connection for AWS S3 or GCS.
3. Cloud credentials are encrypted before they are stored in MongoDB.
4. The user uploads files into the selected bucket.
5. The owner can whitelist teammates on a connection or on individual files.
6. Authorized users can request signed URLs for private downloads.
7. File owners can create expiring public share links.
8. Public share links redirect to short-lived cloud signed URLs.

## Repository Structure

```text
TeamVault/
  client/
    src/
      components/
        Icon.tsx
        Navbar.tsx
      lib/
        axios.ts
      pages/
        landing.tsx
      App.tsx
      App.css
      index.css
      types.ts
    .env.example
    package.json
  server/
    src/
      middleware/
        asyncHandler.ts
        auth.ts
        requestLogger.ts
      models/
        FileObject.ts
        ShareLink.ts
        StorageConnection.ts
        User.ts
      routes/
        auth.ts
        files.ts
        shares.ts
        storage.ts
      services/
        gcs.ts
        s3.ts
        storage.ts
      utils/
        crypto.ts
        logger.ts
      config.ts
      db.ts
      index.ts
    .env.example
    package.json
  PROJECT.md
```

## Environment Variables

### Backend

Create `server/.env` from `server/.env.example`.

```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/teamvault
JWT_SECRET=replace-with-a-long-random-jwt-secret
CRYPTO_SECRET=replace-with-a-long-random-credential-encryption-secret
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
UPLOAD_TMP_DIR=
```

`CRYPTO_SECRET` protects saved cloud credentials. Use a long random value and do not rotate it casually, because existing encrypted credentials need the same secret to decrypt.

`LOG_LEVEL` can be `debug`, `info`, `warn`, or `error`. Logs are structured JSON and include request IDs. `UPLOAD_TMP_DIR` is optional; when empty, TeamVault stores temporary upload files in the operating system temp directory under `teamvault-uploads`.

### Frontend

Create `client/.env` from `client/.env.example`.

```env
VITE_API_URL=http://localhost:4000
```

## Running Locally

Install dependencies in both folders:

```bash
cd server
npm install
```

```bash
cd client
npm install
```

Start MongoDB locally or point `MONGO_URI` at a hosted MongoDB instance.

Run the API:

```bash
cd server
npm run dev
```

Run the frontend:

```bash
cd client
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

## Build Commands

Backend:

```bash
cd server
npm run build
```

Frontend:

```bash
cd client
npm run lint
```

```bash
cd client
npm run build
```

## API Overview

### Auth

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a user and return a JWT |
| `POST` | `/auth/login` | Sign in and return a JWT |
| `GET` | `/auth/me` | Return the authenticated user |
| `GET` | `/auth/users?q=` | Search users for access controls |

### Storage Connections

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/storage/connections` | Create an AWS S3 or GCS connection |
| `GET` | `/storage/connections` | List owned or whitelisted connections |
| `POST` | `/storage/connections/:id/whitelist` | Add or remove user access |

### Files

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/files/upload` | Upload files or folder contents to the selected bucket |
| `GET` | `/files?connectionId=` | List files for a connection |
| `POST` | `/files/:id/whitelist` | Add or remove per-file user access |
| `POST` | `/files/:id/signed-url` | Create an authenticated signed download URL |
| `DELETE` | `/files/:id` | Delete a file from storage and metadata |

`POST /files/upload` uses multipart form data:

- `files`: one or more files.
- `connectionId`: target storage connection ID.
- `keyPrefix`: optional prefix inside the bucket.
- `relativePaths`: JSON array of paths that matches the selected files, used to preserve folder structure.

The backend enforces a 5GB limit per file and a 5GB total limit per upload request. Uploads are streamed from temporary disk storage to S3 or GCS instead of being kept in memory.

### Share Links

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/shares` | Create a public expiring share token |
| `GET` | `/shares/:token` | Redirect to a short-lived cloud signed URL |

## Frontend UX

The frontend is a single-page workspace with:

- Public landing page with product explanation and CTA buttons.
- Auth screen for sign in and registration.
- Sticky app header with profile, refresh, and sign out.
- Sidebar for fast switching between storage connections.
- Dashboard metrics for connections, files, size, and provider mix.
- Files tab with multi-file upload, folder upload where supported by the browser, upload progress, signed URL generation, public share links, deletion, and file-level access controls.
- Access tab with connection-level whitelist management and teammate search.
- Connections tab with AWS S3 and GCS forms, credential setup steps, and a storage map.
- Fixed-position toast messages for success and error feedback.
- Responsive layouts for desktop, tablet, and mobile.

## Security Notes

- Passwords are hashed with bcrypt.
- JWTs expire after 7 days.
- Protected routes require `Authorization: Bearer <token>`.
- AWS and GCS credentials are encrypted with AES-256-GCM before storage.
- Share links are stored with a MongoDB TTL index.
- The public share route also checks expiry manually, because Mongo TTL cleanup is not immediate.
- Signed URLs are short-lived and generated only after authorization checks.
- Connection owners control connection whitelists.
- File owners control file whitelists and public share links.

## Cloud Credential Requirements

### AWS S3

Recommended setup:

1. Create or choose an S3 bucket.
2. Create an IAM user or access key dedicated to TeamVault.
3. Scope the policy to the bucket and optional prefix TeamVault should manage.
4. Add the bucket name, region, access key ID, and secret access key in the TeamVault connection form.

Minimum actions for full app behavior:

- `s3:PutObject`
- `s3:GetObject`
- `s3:DeleteObject`

### Google Cloud Storage

Recommended setup:

1. Create or choose a Google Cloud Storage bucket.
2. Create a service account dedicated to TeamVault.
3. Grant object read, write, delete, and signed URL permissions.
4. Download the service account JSON.
5. Paste the full JSON into the TeamVault GCS connection form.

The service account needs permissions to:

- Write objects.
- Read objects.
- Delete objects.
- Generate signed URLs.

## Logging And Debugging

The backend writes structured JSON logs to stdout/stderr. Each request gets an `X-Request-Id` response header, and that same request ID appears in logs and error responses.

Logged events include:

- `server.started`
- `request.started`
- `request.finished`
- `request.failed`
- `request.upload.failed`
- `files.upload.started`
- `files.upload.completed`

Use `LOG_LEVEL=debug` for more verbose local debugging and `LOG_LEVEL=info` for normal development.

## Data Model

### User

Stores account identity and password hash.

### StorageConnection

Stores provider, bucket, owner, optional prefix, whitelisted users, and encrypted provider credentials.

### FileObject

Stores metadata for files uploaded through TeamVault, including storage key, owner, connection, MIME type, size, and per-file whitelisted users.

### ShareLink

Stores a share token, target file, expiry date, and download count. Expired share links are automatically removed by MongoDB TTL cleanup.

## Implementation Notes

- The frontend keeps the JWT in local storage under `teamvault_token`.
- Axios attaches the JWT to API requests automatically.
- `VITE_API_URL` controls the API base URL.
- The backend accepts comma-separated `CORS_ORIGIN` values. If `CORS_ORIGIN=*`, it reflects the request origin for credential-compatible CORS behavior.
- File uploads use multipart form data through Multer disk storage.
- Temporary upload files are removed after each upload attempt.
- The frontend checks the 5GB upload cap before sending files, and the backend enforces the same cap.
- The app tracks metadata only for files uploaded through TeamVault.

## Verification Completed

The following commands have been run successfully:

```bash
cd server
npm run build
```

```bash
cd client
npm run build
```
