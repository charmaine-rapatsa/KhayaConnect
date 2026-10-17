# KhayaConnect

KhayaConnect is a community care coordination application for older adults, families, community health workers (CHWs), clinics, and administrators. This repository contains a Django REST API and a React/Vite frontend.

## Features

- Role-based sign-in for older adults, family members, CHWs, clinic staff, and administrators.
- Role-scoped API endpoints for care coordination, assignments, visits, medication, appointments, emergency requests, and user and relationship management.
- CSRF-protected session authentication and in-app notifications for linked care teams and administrators.

## Project layout

- `config/` — Django project configuration.
- `core/` — API, application models, and management commands.
- `frontend/` — React and Vite web application.
- `requirements.txt` — Python dependencies.

## Run locally

### Requirements

- Python 3.11 or newer.
- Node.js and npm.
- MySQL Server and a `khayaconnect` database with the application's existing tables.

### Backend

From the repository root, create and configure a local `.env` file. Start with the safe template:

```powershell
Copy-Item .env.example .env
```

Set a private `DJANGO_SECRET_KEY` and your local MySQL settings in `.env`. Never commit `.env` or put database credentials in frontend environment variables.

Create a Python environment, install the dependencies, and run Django:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py check
python manage.py runserver
```

The API runs at `http://127.0.0.1:8000` by default.

### Frontend

In a second terminal, from the repository root:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`). The Vite development proxy sends `/api` requests to Django at `http://127.0.0.1:8000`.

## Database and deployment notes

The application models in `core/db_models.py` represent existing, unmanaged database tables. The repository does not include the database or its records. Do not run `migrate` against an existing KhayaConnect database until its schema and migration plan have been reviewed. Keep database credentials and Django's secret key in environment variables.

For deployment, configure HTTPS, allowed hosts, CSRF trusted origins, and CORS for the actual frontend domain. Route same-origin `/api` requests to Django through the hosting proxy. Use a dedicated, least-privilege MySQL account; do not deploy with a global MySQL administrator account.

## Current limitations

- Emergency requests create in-app notifications; they do not contact emergency services or send SMS or push notifications.
- The application does not provide a self-service password-reset endpoint or a reminder-delivery service.
- Voice instructions play locally. No external AI provider is configured.
- Custom application models are not registered in Django Admin; administrators use the application's role-based dashboard.

## GitHub repository description

Suggested description: **Community care coordination for older adults, families, CHWs, clinics, and administrators.**
