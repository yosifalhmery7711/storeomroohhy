import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    let serverModule;
    try {
      // Attempt importing server.ts with full extension first (recommended for Node ESM)
      serverModule = await import('../server.ts');
    } catch (e1) {
      try {
        serverModule = await import('../server.js');
      } catch (e2) {
        serverModule = await import('../server');
      }
    }
    
    const app = serverModule.default;
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Entry] Critical server initialization failure:', err);
    res.status(500).json({
      success: false,
      error: 'فشل تهيئة خادم المتجر (Failed to initialize store server)',
      details: err?.message || String(err),
      stack: err?.stack,
      envKeysPresent: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        VITE_SUPABASE_DB_URL: !!process.env.VITE_SUPABASE_DB_URL,
        VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY
      }
    });
  }
}
