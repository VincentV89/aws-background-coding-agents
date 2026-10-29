# AWS Background Coding Agents

A starter repository for coding tasks run by autonomous background agents on AWS.

Agents propose changes on branches and open pull requests for human review.

## Tetris

A playable Tetris game built with React, TypeScript and Vite.

### Run locally

Requires Node.js 20+ (tested with Node 24).

```bash
npm install      # install dependencies
npm run dev      # start dev server at http://localhost:5173
```

Other scripts:

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run build`     | Type-check and create a production build in `dist/` |
| `npm run preview`   | Serve the production build locally           |
| `npm test`          | Run the game-logic unit tests (Vitest)       |
| `npm run typecheck` | Run the TypeScript compiler only             |

The same tasks are available through mise: `mise run build`, `mise run lint`, `mise run test`.

The production build uses relative asset paths (`base: './'`), so you can host the
`dist/` folder from any static host or sub-path (e.g. S3, GitHub Pages).

### Controls

| Key            | Action        |
| -------------- | ------------- |
| ← / →          | Move          |
| ↑              | Rotate        |
| ↓              | Soft drop     |
| Space          | Hard drop     |
| P / Esc        | Pause/resume  |
| R              | Restart       |

On-screen Pause/Restart buttons are always shown. On small or touch screens the layout
stacks vertically and touch buttons appear for movement and drops.

### Scoring

- Line clears: 100 / 300 / 500 / 800 points for 1–4 lines, multiplied by the current level.
- Soft drop: 1 point per cell. Hard drop: 2 points per cell.
- Level goes up every 10 lines, and pieces fall faster at each level.

### Project structure

- `src/game/tetris.ts`: game logic as pure functions (board, pieces, collisions, scoring, reducer)
- `src/game/tetris.test.ts`: unit tests for the game logic
- `src/App.tsx`: React UI, keyboard handling and the gravity timer
- `src/App.css`: styles, including the responsive layout

### Deploy to AWS (CI/CD)

`.github/workflows/deploy.yml` builds, type-checks and tests the app, then syncs `dist/` to an
S3 bucket (and optionally invalidates a CloudFront distribution). It runs on every push to
`main` and can also be started manually (Actions → Deploy to AWS → Run workflow).

The deploy job uses the GitHub environment **`production`**. Create it under
Settings → Environments and add these environment secrets:

| Secret                       | Required | Description                                          |
| ---------------------------- | -------- | ---------------------------------------------------- |
| `AWS_REGION`                 | yes      | AWS region, e.g. `us-east-1`                         |
| `S3_BUCKET`                  | yes      | Target bucket name (without `s3://`)                 |
| `AWS_ROLE_ARN`               | one of   | IAM role to assume via GitHub OIDC (recommended)     |
| `AWS_ACCESS_KEY_ID`          | one of   | Static IAM credentials (use with the secret key)     |
| `AWS_SECRET_ACCESS_KEY`      | one of   | Static IAM credentials (use with the access key ID)  |
| `CLOUDFRONT_DISTRIBUTION_ID` | no       | If set, `/*` is invalidated after upload             |

The credentials need `s3:ListBucket` on the bucket, `s3:PutObject`/`s3:DeleteObject` on its
objects, and `cloudfront:CreateInvalidation` if CloudFront is used. Note the sync uses
`--delete`, so the bucket should be dedicated to this site.
