# Vercel Deployment & Environment Variables Guide

## 1. Public Variables (Available to Frontend)
Add these in your Vercel Dashboard -> Project Settings -> Environment Variables.

- `VITE_SUPABASE_URL` = https://your-project-id.supabase.co
- `VITE_SUPABASE_ANON_KEY` = sb_publishable_bzMOKDOqC0dR8Ec_DAKZMA_13wY-oVl
- `VITE_FIREBASE_API_KEY` = [Your Firebase API Key]
- `VITE_FIREBASE_AUTH_DOMAIN` = [Your Firebase Auth Domain]
- `VITE_FIREBASE_PROJECT_ID` = [Your Firebase Project ID]
- `VITE_FIREBASE_STORAGE_BUCKET` = [Your Firebase Storage Bucket]
- `VITE_FIREBASE_MESSAGING_SENDER_ID` = [Your Firebase Messaging Sender ID]
- `VITE_FIREBASE_APP_ID` = [Your Firebase App ID]
- `VITE_FIREBASE_VAPID_KEY` = [Your Firebase VAPID Key for Web Push]

## 2. Server-Only Variables (Backend ONLY - SECURE)
These variables are ONLY available to the backend Vercel Serverless Functions (`/api/*`).

- `SUPABASE_SERVICE_ROLE_KEY` = sb_secret_8edNv_ECVLdQbNuol2NTtA_8wvucqm5
- `FIREBASE_PROJECT_ID` = [Your Firebase Project ID]
- `FIREBASE_CLIENT_EMAIL` = [Firebase Service Account Client Email]
- `FIREBASE_PRIVATE_KEY` = [Firebase Service Account Private Key] (Be sure to include \n properly)
- `ADMIN_PASSCODE` = Sanad#2025 (Or whatever password you use for the admin panel)

## 3. Deployment Notes
- Ensure your `vercel.json` contains appropriate rewriting rules if you run into 404s on refresh (React Router).
- Make sure `firebase-messaging-sw.js` has the correct Firebase credentials populated either via build step or manually replaced before deployment!
