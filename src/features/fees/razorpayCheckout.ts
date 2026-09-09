/**
 * Thin wrapper around Razorpay's hosted Checkout widget (test mode).
 *
 * Checkout.js is loaded from Razorpay's CDN on first use (it must be served from
 * there — it is not bundled). The widget captures the card details directly and
 * sends them to Razorpay; our code only ever sees the order id and, on success,
 * safe reference ids — never raw card data (plan section 7.2a).
 */

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number; // in the smallest currency unit (paise)
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
};

type RazorpayInstance = { open: () => void };
type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** Thrown when the shopper closes the Checkout widget without paying. */
export class CheckoutDismissedError extends Error {
  constructor() {
    super('checkout dismissed');
    this.name = 'CheckoutDismissedError';
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // allow a retry
      reject(new Error('Could not load Razorpay Checkout'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export type OpenCheckoutParams = {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency: string;
  /** Shown as the merchant name in the widget. */
  name: string;
  /** Shown under the name — e.g. the fee structure. */
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
};

/**
 * Opens the Razorpay Checkout widget for an existing order and resolves with the
 * success payload. Rejects with {@link CheckoutDismissedError} if the shopper
 * closes the widget, or a plain Error if the script fails to load.
 */
export async function openRazorpayCheckout(params: OpenCheckoutParams): Promise<RazorpaySuccess> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay Checkout is unavailable');

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let settled = false;
    const instance = new Razorpay({
      key: params.keyId,
      amount: params.amountInPaise,
      currency: params.currency,
      name: params.name,
      description: params.description,
      order_id: params.orderId,
      prefill: params.prefill,
      theme: params.themeColor ? { color: params.themeColor } : undefined,
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new CheckoutDismissedError());
        },
      },
    });
    instance.open();
  });
}
