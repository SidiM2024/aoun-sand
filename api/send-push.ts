import { createClient } from '@supabase/supabase-js';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (only initialize once)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Initialize Supabase using Service Role Key to bypass RLS and fetch users
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { title, message, adminPasscode } = req.body;

    // Secure the API: Only allow our admin to send pushes
    if (adminPasscode !== process.env.ADMIN_PASSCODE) {
      return res.status(401).json({ error: 'Unauthorized: Invalid admin passcode' });
    }

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    // Fetch all users with FCM tokens
    const { data: users, error: supabaseError } = await supabase
      .from('users')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    if (supabaseError) {
      throw new Error(`Supabase Error: ${supabaseError.message}`);
    }

    if (!users || users.length === 0) {
      return res.status(200).json({ success: true, message: 'No users with FCM tokens found' });
    }

    // Extract valid tokens
    const tokens = users.map((u) => u.fcm_token).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, message: 'No valid tokens found' });
    }

    // Send the push notification via Firebase Admin
    const payload = {
      notification: {
        title,
        body: message,
      },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(payload);

    return res.status(200).json({ 
      success: true, 
      message: `Notifications sent: ${response.successCount} successful, ${response.failureCount} failed`,
      details: response
    });

  } catch (error) {
    console.error('Error sending push notifications:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
