import type { EnquiryStatus, FollowUpType } from '../../api/enquiries';

export const ENQUIRY_STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PASSIVE', label: 'Passive' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'DEAD', label: 'Dead' },
];

export const ENQUIRY_STATUS_COLOR: Record<EnquiryStatus, string> = {
  ACTIVE: 'processing',
  WON: 'success',
  PASSIVE: 'default',
  LOST: 'error',
  DEAD: 'default',
};

export function enquiryStatusLabel(status: EnquiryStatus): string {
  return ENQUIRY_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export const FOLLOW_UP_TYPE_OPTIONS: { value: FollowUpType; label: string }[] = [
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISIT', label: 'Visit' },
  { value: 'OTHER', label: 'Other' },
];
