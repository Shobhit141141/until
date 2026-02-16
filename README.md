# UNTIL

<p align="center">
  <img src="./client/public/logo.png" alt="UNTIL" width="120" />
</p>

**Skill-based quiz. Pay per question. Stop when it's optimal.**

---

## Links

| | |
|:--|:--|
| **Whitepaper** | [until.gg/whitepaper](./client/public/whitepaper.md) |
| **Live Demo** | [until.gg](https://until-stx.vercel.app) |

## Tech stack

<p>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis" alt="Redis" />
  <img src="https://img.shields.io/badge/Stacks-STX-5546FF?logo=stacks" alt="Stacks" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss" alt="Tailwind" />
</p>

| Layer | Stack |
|:--|:--|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind, Stacks Connect |
| **Backend** | Node.js, Express, TypeScript |
| **Data** | MongoDB (Mongoose), Redis |
| **Chain** | Stacks (STX), x402 |

---

## Repo structure

- **`client/`** — Next.js app (App Router)
- **`server/`** — Express API (credits, questions, runs, users)
- **`docs/`** — Whitepaper (source), roadmap, audit

---

## Quick start

```bash
# Client
cd client && npm install && npm run dev

# Server (separate terminal; needs Mongo, Redis, .env)
cd server && npm install && npm run dev
```

See `client/.env.example` and `server/.env.example` for required env vars.
