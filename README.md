# TeamVault

## Description

**Result:** TeamVault helps teams share cloud-stored files securely without exposing raw storage credentials or losing control over access.

**Action:** Users connect their storage, upload files or folders, invite teammates, share selected files, and create expiring public links when needed.

**Context:** It is designed for teams that already use AWS S3 or Google Cloud Storage and need a cleaner, safer collaboration layer on top of private buckets.

## Features

- Secure user authentication.
- AWS S3 and Google Cloud Storage support.
- File and folder uploads up to 5GB.
- Workspace-style team access.
- File-level sharing with workspace members.
- Expiring public share links.
- Signed download links.
- Encrypted storage credentials.
- Responsive modern dashboard.
- Helpful toast messages for upload, sharing, and access actions.
- Backend logging for future debugging.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Node.js
- Express
- MongoDB
- Mongoose
- AWS SDK
- Google Cloud Storage SDK

## Use Cases

- Sharing private bucket files with teammates.
- Creating short-lived download links for external collaborators.
- Giving teams a simple UI over cloud object storage.
- Keeping cloud credentials away from everyday users.
- Managing file access for small teams, internal tools, agencies, and client delivery workflows.

## Product Flow

1. Create an account or sign in.
2. Connect an AWS S3 or Google Cloud Storage bucket.
3. Add teammates to the workspace.
4. Upload files or folders.
5. Share selected files with workspace members.
6. Create expiring public links for controlled external sharing.

## Documentation

See [PROJECT.md](./PROJECT.md) for full setup, API, security, logging, and access-management details.
