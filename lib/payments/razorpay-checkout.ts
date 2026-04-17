// ============================================================================
// Razorpay Checkout — Client-side utility for opening payment modal
// ============================================================================

interface RazorpayCheckoutOptions {
  orderId: string;
  amount: number; // in paise (₹100 = 10000)
  currency?: string;
  name?: string;
  description?: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillPhone?: string;
  prefillUpi?: string;
  onSuccess: (response: RazorpaySuccessResponse) => void;
  onFailure: (error: string) => void;
  onDismiss?: () => void;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayWindow {
  Razorpay: new (options: Record<string, unknown>) => {
    open: () => void;
    on: (event: string, handler: () => void) => void;
  };
}

/**
 * Load the Razorpay checkout script dynamically
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as unknown as RazorpayWindow).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay checkout modal
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    options.onFailure('Razorpay key not configured');
    return;
  }

  try {
    await loadRazorpayScript();
  } catch {
    options.onFailure('Failed to load payment gateway');
    return;
  }

  const rzpOptions: Record<string, unknown> = {
    key: keyId,
    amount: options.amount,
    currency: options.currency || 'INR',
    name: options.name || 'SafeShift Insurance',
    description: options.description || 'Weekly Premium Payment',
    order_id: options.orderId,
    handler: (response: RazorpaySuccessResponse) => {
      options.onSuccess(response);
    },
    prefill: {
      name: options.prefillName || '',
      email: options.prefillEmail || '',
      contact: options.prefillPhone || '',
      vpa: options.prefillUpi || '',
    },
    theme: {
      color: '#F07820',
    },
    modal: {
      ondismiss: () => {
        if (options.onDismiss) options.onDismiss();
      },
    },
    method: {
      upi: true,
      card: true,
      netbanking: true,
      wallet: true,
    },
  };

  const rzp = new ((window as unknown as RazorpayWindow).Razorpay)(rzpOptions);
  rzp.open();
}
