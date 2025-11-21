# Accordo Backend

Greenfield rewrite of the Accordo backend using a modular architecture. The goal is to preserve every existing API endpoint and behaviour while adopting a cleaner project layout.

## Project Structure

```
├── index.js                # Application entrypoint
├── src/
│   ├── config/             # Environment, logging, database configuration
│   ├── loaders/            # Express and other bootstrapping logic
│   ├── middlewares/        # Shared Express middlewares
│   ├── modules/            # Feature modules (controllers, services, repos)
│   ├── models/             # Sequelize model factories
│   ├── routes/             # API route definitions
│   ├── seeders/            # Deterministic data seeders
│   └── utils/              # Shared helpers
├── scripts/                # Custom CLI scripts
├── logs/                   # Application logs (gitignored)
└── tests/                  # Manual/automated tests
```

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

Use `npm run migrate` and `npm run seed` after the Sequelize models are added.

## Next Steps

- Port legacy Sequelize models into `src/models` and re-create associations.
- Implement repositories/services/controllers inside `src/modules` while keeping route signatures identical to the previous project.
- Rebuild deterministic seeders in `src/seeders` to support manual testing.
- Perform manual regression on every endpoint once the port is complete.

