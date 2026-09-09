import { useState } from 'react';
import { App, Button, theme } from 'antd';
import { useAuthStore } from '../../store/authStore';
import {
  simulateInvoicePayment,
  startInvoiceCheckout,
  type Invoice,
} from '../../api/fees';
import { CheckoutDismissedError, openRazorpayCheckout } from './razorpayCheckout';
import { formatAmount } from './format';

type Props = {
  invoice: Invoice;
  /** Shown in the Razorpay widget under the school name — usually the fee structure name. */
  description: string;
  /** Called after the invoice has been marked PAID so the caller can refresh its list. */
  onPaid: () => void;
};

/**
 * "Pay now" for a single PENDING invoice: create a Razorpay Order, open the
 * hosted Checkout widget in test mode, then confirm.
 */
function PayNowButton({ invoice, description, onPaid }: Props) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const user = useAuthStore((state) => state.user);
  const [paying, setPaying] = useState(false);

  if (invoice.status !== 'PENDING') return null;

  const pay = async () => {
    setPaying(true);
    try {
      const order = await startInvoiceCheckout(invoice.id);

      try {
        await openRazorpayCheckout({
          keyId: order.razorpayKeyId,
          orderId: order.razorpayOrderId,
          amountInPaise: order.amountInPaise,
          currency: order.currency,
          name: 'School fees',
          description,
          prefill: { name: user?.name ?? undefined },
          themeColor: token.colorPrimary,
        });
      } catch (error) {
        if (error instanceof CheckoutDismissedError) {
          message.info('Payment cancelled — the invoice is still due.');
          return;
        }
        throw error;
      }

      // ── DEMO ONLY ────────────────────────────────────────────────────────
      // In a deployed setup, Razorpay confirms the payment by calling our
      // signature-verified webhook (POST /api/v1/webhooks/razorpay), which flips
      // the invoice to PAID. That webhook needs a public URL Razorpay can reach,
      // which isn't available in local development, so for the demo we call the
      // dev-tools endpoint to stand in for it. It is gated server-side by
      // `app.dev-tools-enabled` and must be removed before any real deployment —
      // real payment confirmation must always come through the webhook.
      await simulateInvoicePayment(invoice.id);

      message.success(`Payment of ${formatAmount(invoice.amount)} received — invoice marked paid.`);
      onPaid();
    } catch {
      message.error('Payment could not be completed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <Button type="primary" size="small" loading={paying} onClick={pay}>
      Pay now
    </Button>
  );
}

export default PayNowButton;
