import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { supabase, isSupabaseConfigured } from './supabase';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Helper to upload a base64 or file Blob directly to Google Drive and make it viewable
export const uploadFileToDrive = async (
  fileDataUrlOrBlob: string | Blob,
  fileName: string
): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('يجب تسجيل الدخول باستخدام حساب جوجل لرفع الملفات إلى جوجل درايف.');
  }

  let blob: Blob;
  if (typeof fileDataUrlOrBlob === 'string') {
    // Convert base64 DataURL to Blob
    const arr = fileDataUrlOrBlob.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    blob = new Blob([u8arr], { type: mime });
  } else {
    blob = fileDataUrlOrBlob;
  }

  // 1. Upload file metadata and media using multipart/related
  const metadata = {
    name: fileName,
    mimeType: blob.type,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: form
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error('Drive upload failed response:', errText);
    throw new Error('فشل رفع الملف إلى Google Drive.');
  }

  const driveFile = await uploadRes.json();
  const fileId = driveFile.id;

  // 2. Set file permissions so anyone with link can view it (critical for rendering inside the app)
  try {
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permRes.ok) {
      console.warn('Could not set public permissions on file:', await permRes.text());
    }
  } catch (permErr) {
    console.warn('Error setting Google Drive file permission:', permErr);
  }

  // Construct sharing link
  return `https://drive.google.com/file/d/${fileId}/view`;
};
