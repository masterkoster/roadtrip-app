import { useState } from 'react';
import api from '../../api/client';

interface OrderBookDialogProps {
  pageCount: number;
  photoCount: number;
  tripTitle: string;
  tripId: number;
  onClose: () => void;
}

type Step = 'intro' | 'products' | 'address' | 'checkout';

interface PodPackage {
  pod_package_id: string;
  description: string;
  name: string;
}

function extractPrice(desc: string): string {
  const m = desc.match(/\$[\d.]+/);
  return m ? m[0] : '';
}

export default function OrderBookDialog({ pageCount, photoCount, tripTitle, tripId, onClose }: OrderBookDialogProps) {
  const [step, setStep] = useState<Step>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedPackage, setSelectedPackage] = useState('0850X1100CBBSTDPB060UW444MXX');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const handleStart = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/lulu/config');
      if (!data.configured) {
        setError('Lulu API is not configured yet. See PHOTO_BOOK_API_SETUP.md for setup instructions.');
        setLoading(false);
        return;
      }
      setStep('products');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to connect to ordering service');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!name || !street || !city || !state || !zip) {
      setError('Please fill in all shipping fields');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data: job } = await api.post('/lulu/submit-order', {
        podPackageId: selectedPackage,
        quantity: 1,
        contactEmail: 'customer@example.com',
        shippingLevel: 'MAIL',
        title: tripTitle,
        interiorUrl: `${window.location.origin}/api/lulu/print-ready/${tripId}/interior`,
        coverUrl: `${window.location.origin}/api/lulu/print-ready/${tripId}/cover`,
        shippingAddress: {
          name,
          street1: street,
          city,
          state_code: state,
          country_code: 'US',
          postcode: zip,
          phone_number: '',
        },
      });

      if (job?.id) {
        setStep('checkout');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit order');
    }
    setLoading(false);
  };

  const handleRetry = () => {
    setError('');
    setStep('intro');
  };

  const products = [
    { id: '0850X1100CBBSTDPB060UW444MXX', label: '8.5×11" Hardcover Portrait', desc: 'Classic photo book, standard print size', price: '~$10–15' },
    { id: '1100X0850CBBSTDPB060UW444MXX', label: '11×8.5" Hardcover Landscape', desc: 'Wide format, great for panoramas', price: '~$12–17' },
    { id: '0800X0800CBBSTDPB060UW444MXX', label: '8×8" Square Hardcover', desc: 'Premium square format, 20+ pages', price: '~$8–12' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Order Photo Book</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {step === 'intro' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{tripTitle}</p>
                  <p className="text-xs text-gray-400">{pageCount} pages &middot; {photoCount} photos</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                Print a premium hardcover photo book of your road trip story through Lulu.
                You'll choose a size, enter a shipping address, and pay directly through
                their secure checkout.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-xs text-amber-800">You'll pay Lulu directly for printing and shipping. The API key must be configured first — see PHOTO_BOOK_API_SETUP.md.</p>
              </div>
            </div>
          )}

          {step === 'products' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Choose your book format. These are print costs — Lulu charges wholesale, you keep any markup.</p>

              <div className="grid gap-3">
                {products.map(p => (
                  <label key={p.id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-amber-300 transition-colors cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50/50">
                    <input
                      type="radio"
                      name="product"
                      className="accent-amber-600"
                      checked={selectedPackage === p.id}
                      onChange={() => setSelectedPackage(p.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{p.label}</div>
                      <div className="text-xs text-gray-400">{p.desc}</div>
                    </div>
                    <div className="text-sm font-bold text-amber-700">{p.price}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Where should we ship the book?</p>

              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Street Address</label>
                  <input type="text" value={street} onChange={e => setStreet(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label className="text-xs text-gray-500 font-medium block mb-1">City</label>
                    <input type="text" value={city} onChange={e => setCity(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">State</label>
                    <input type="text" value={state} onChange={e => setState(e.target.value)} maxLength={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">ZIP</label>
                    <input type="text" value={zip} onChange={e => setZip(e.target.value)} maxLength={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'checkout' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm text-gray-600">Your order has been submitted to Lulu! Check the Lulu developer portal to pay and track your order.</p>
              <a href="https://developers.lulu.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg">
                Go to Lulu Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div>
            {error && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-auto">
            {step === 'intro' && (
              <>
                <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                <button onClick={handleStart} disabled={loading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
                  {loading ? 'Connecting...' : 'Continue'}
                </button>
              </>
            )}
            {step === 'products' && (
              <>
                <button onClick={() => setStep('intro')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Back</button>
                <button onClick={() => setStep('address')} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-all">Next: Shipping</button>
              </>
            )}
            {step === 'address' && (
              <>
                <button onClick={() => setStep('products')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Back</button>
                <button onClick={handleSubmit} disabled={loading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded-lg text-sm font-semibold transition-all flex items-center gap-2">
                  {loading ? 'Submitting...' : 'Submit Order'}
                </button>
              </>
            )}
            {step === 'checkout' && (
              <button onClick={onClose} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-all">Done</button>
            )}
            {error && step !== 'checkout' && (
              <button onClick={handleRetry} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Retry</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
