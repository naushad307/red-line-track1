# OHE Track Management System — MongoDB Backend (No Docker Required)

This version uses MongoDB as the permanent backend for the existing OHE Track Layout application.

## Important
Docker is **not required**. Install MongoDB Community Server locally and keep the MongoDB Windows service running.

The application connects to:

`mongodb://127.0.0.1:27017/ohe_track_line01`

MongoDB's Node.js driver documentation confirms that a local MongoDB deployment can be reached on `localhost:27017` / `mongodb://localhost:27017`. 

## 1. Install requirements

- Node.js 20+ recommended
- MongoDB Community Server

Check:

```powershell
mongod --version
node --version
npm --version
```

## 2. Configure `.env`

Copy `.env.example` to `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/ohe_track_line01
ADMIN_VERIFICATION_CODE=CHANGE_THIS_TO_A_SECRET_CODE
SESSION_DAYS=7
```

## 3. Install packages

```powershell
npm install
```

## 4. Import the original HTML data into MongoDB

```powershell
npm run seed
```

This imports the supplied OHE/track seed data into the MongoDB collections.

## 5. Start the application

```powershell
npm start
```

Open:

`http://localhost:3000`

## 6. Data flow

### MongoDB → App
After Admin/User login, the app fetches the current MongoDB data through `/api`.

### Manage Data → MongoDB
Admin changes in Manage Data mark the application as unsaved. Click **Save** to write the current application data to MongoDB.

### Export JSON
The **Export All** function remains available for a local JSON backup.

## 7. Permissions

- Admin: View + Manage Data + MongoDB Save/Push
- User: View only
- No API token is required from the user
- Admin verification code is server-side only for initial Admin creation and Admin password/account actions

## 8. If MongoDB is not running

PowerShell:

```powershell
Get-Service MongoDB
```

If stopped:

```powershell
Start-Service MongoDB
```

Then start the Node server again.

## 9. Do NOT run Docker commands

This package works without Docker. You do not need:

```powershell
docker compose up -d
```
