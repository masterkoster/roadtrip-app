import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const LULU_API_KEY = process.env.LULU_API_KEY || '';
const LULU_API_SECRET = process.env.LULU_API_SECRET || '';
const LULU_BASE = process.env.LULU_ENV === 'production'
  ? 'https://api.lulu.com'
  : 'https://api.sandbox.lulu.com';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${LULU_API_KEY}:${LULU_API_SECRET}`).toString('base64');

  const res = await fetch(`${LULU_BASE}/auth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Lulu auth failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function luluFetch(path: string, options?: RequestInit) {
  const token = await getToken();
  const url = `${LULU_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Lulu API ${res.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

// GET /api/lulu/config — check if API is configured
router.get('/config', (_req: AuthRequest, res: Response) => {
  res.json({
    configured: !!(LULU_API_KEY && LULU_API_SECRET),
    env: process.env.LULU_ENV || 'sandbox',
  });
});

// GET /api/lulu/pod-packages — list available book SKUs
router.get('/pod-packages', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const data = await luluFetch('/pod-packages/?limit=50');
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch products' });
  }
});

// POST /api/lulu/cost-calculation — estimate print cost
router.post('/cost-calculation', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { podPackageId, pageCount } = req.body;
    const data = await luluFetch('/print-jobs/print-job-cost-calculations/', {
      method: 'POST',
      body: JSON.stringify({
        line_items: [{
          pod_package_id: podPackageId || '0600X0900BWSTDPB060UW444MXX',
          quantity: 1,
        }],
      }),
    });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to calculate cost' });
  }
});

// POST /api/lulu/shipping-options — get shipping rates
router.post('/shipping-options', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { countryCode } = req.body;
    const data = await luluFetch('/shipping-options/?country_code=' + (countryCode || 'US'));
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to get shipping options' });
  }
});

// POST /api/lulu/submit-order — submit a print job
router.post('/submit-order', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      podPackageId,
      quantity,
      contactEmail,
      shippingLevel,
      shippingAddress,
      interiorUrl,
      coverUrl,
      title,
    } = req.body;

    const body: Record<string, any> = {
      contact_email: contactEmail || 'customer@example.com',
      shipping_level: shippingLevel || 'MAIL',
      line_items: [{
        pod_package_id: podPackageId || '0600X0900BWSTDPB060UW444MXX',
        quantity: quantity || 1,
        title: title || 'My Road Trip Storybook',
        interior: {
          source_url: interiorUrl,
        },
        cover: {
          source_url: coverUrl,
        },
      }],
      shipping_address: shippingAddress || {
        name: 'Customer',
        street1: '123 Main St',
        city: 'Chicago',
        state_code: 'IL',
        country_code: 'US',
        postcode: '60601',
        phone_number: '',
      },
    };

    const data = await luluFetch('/print-jobs/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit order' });
  }
});

// GET /api/lulu/order-status/:id — check job status
router.get('/order-status/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = await luluFetch(`/print-jobs/${req.params.id}/`);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to check order status' });
  }
});

export default router;
