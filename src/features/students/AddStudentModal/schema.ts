import { z } from 'zod';
import dayjs from 'dayjs';
import type { BloodGroup, Gender, GuardianRelationship, PreferredLanguage } from '../../../api/students';

export const MOBILE_REGEX = /^\+?[0-9]{10,15}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];

export const RELATIONSHIP_OPTIONS: { value: GuardianRelationship; label: string }[] = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other' },
];
export const RELATIONSHIP_LABEL: Record<GuardianRelationship, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GUARDIAN: 'Guardian',
  OTHER: 'Other',
};

export const LANGUAGE_OPTIONS: { value: PreferredLanguage; label: string }[] = [
  { value: 'ENGLISH', label: 'English' },
  { value: 'TAMIL', label: 'Tamil' },
  { value: 'HINDI', label: 'Hindi' },
  { value: 'OTHER', label: 'Other' },
];
const LANGUAGE_LABEL: Record<PreferredLanguage, string> = {
  ENGLISH: 'English',
  TAMIL: 'Tamil',
  HINDI: 'Hindi',
  OTHER: 'Other',
};
export function languageLabel(value: PreferredLanguage): string {
  return LANGUAGE_LABEL[value];
}

const optionalMobile = z
  .string()
  .trim()
  .regex(MOBILE_REGEX, 'Enter a valid mobile number (10-15 digits)')
  .optional()
  .or(z.literal(''));

const optionalEmail = z
  .string()
  .trim()
  .max(200, 'Keep this under 200 characters')
  .email('Enter a valid email address')
  .optional()
  .or(z.literal(''));

export const schema = z.object({
  // --- Step 1: Student details ---
  schoolId: z.string().min(1, 'Select a school'),
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'Keep this under 100 characters'),
  middleName: z.string().trim().max(100, 'Keep this under 100 characters').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Keep this under 100 characters'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { required_error: 'Select a gender' }),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((value) => dayjs(value).isValid(), 'Enter a valid date')
    .refine((value) => !dayjs(value).isAfter(dayjs(), 'day'), 'Date of birth cannot be in the future'),
  admissionNumber: z
    .string()
    .trim()
    .min(1, 'Admission number is required')
    .max(60, 'Keep this under 60 characters'),
  admissionDate: z.string().min(1, 'Admission date is required'),
  rollNumber: z.string().trim().max(20, 'Keep this under 20 characters').optional(),
  classId: z.string().min(1, 'Select a class'),
  sectionId: z.string().min(1, 'Select a section'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
  nationality: z.string().trim().max(100, 'Keep this under 100 characters').optional(),
  motherTongue: z.string().trim().max(100, 'Keep this under 100 characters').optional(),

  // --- Step 2: Parent / guardian & contact ---
  guardianName: z.string().trim().min(1, 'Guardian name is required').max(200, 'Keep this under 200 characters'),
  guardianRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'], {
    required_error: 'Select a relationship',
  }),
  guardianPhone: z
    .string()
    .trim()
    .min(1, 'Mobile number is required')
    .regex(MOBILE_REGEX, 'Enter a valid mobile number (10-15 digits)'),
  guardianAlternatePhone: optionalMobile,
  guardianEmail: optionalEmail,
  guardianOccupation: z.string().trim().max(200, 'Keep this under 200 characters').optional(),

  fatherName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  fatherMobile: optionalMobile,
  fatherEmail: optionalEmail,
  fatherOccupation: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  motherName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  motherMobile: optionalMobile,
  motherEmail: optionalEmail,
  motherOccupation: z.string().trim().max(200, 'Keep this under 200 characters').optional(),

  emergencyContactName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  emergencyContactRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER']).optional(),
  emergencyContactMobile: optionalMobile,

  // --- Step 3: Address & communication ---
  addressLine1: z.string().trim().min(1, 'Address line 1 is required').max(255, 'Keep this under 255 characters'),
  addressLine2: z.string().trim().max(255, 'Keep this under 255 characters').optional(),
  city: z.string().trim().min(1, 'City is required').max(100, 'Keep this under 100 characters'),
  state: z.string().trim().min(1, 'State is required').max(100, 'Keep this under 100 characters'),
  pincode: z.string().trim().min(1, 'PIN code is required').regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),

  smsNotificationsEnabled: z.boolean(),
  whatsappNotificationsEnabled: z.boolean(),
  emailNotificationsEnabled: z.boolean(),
  preferredLanguage: z.enum(['ENGLISH', 'TAMIL', 'HINDI', 'OTHER']),
});

export type FormValues = z.infer<typeof schema>;

export const EMPTY_FORM: FormValues = {
  schoolId: '',
  firstName: '',
  middleName: undefined,
  lastName: '',
  gender: undefined as unknown as FormValues['gender'],
  dateOfBirth: '',
  admissionNumber: '',
  admissionDate: dayjs().format('YYYY-MM-DD'),
  rollNumber: undefined,
  classId: '',
  sectionId: '',
  bloodGroup: undefined,
  nationality: 'Indian',
  motherTongue: undefined,

  guardianName: '',
  guardianRelationship: undefined as unknown as FormValues['guardianRelationship'],
  guardianPhone: '',
  guardianAlternatePhone: undefined,
  guardianEmail: undefined,
  guardianOccupation: undefined,

  fatherName: undefined,
  fatherMobile: undefined,
  fatherEmail: undefined,
  fatherOccupation: undefined,
  motherName: undefined,
  motherMobile: undefined,
  motherEmail: undefined,
  motherOccupation: undefined,

  emergencyContactName: undefined,
  emergencyContactRelationship: undefined,
  emergencyContactMobile: undefined,

  addressLine1: '',
  addressLine2: undefined,
  city: '',
  state: '',
  pincode: '',

  smsNotificationsEnabled: true,
  whatsappNotificationsEnabled: true,
  emailNotificationsEnabled: true,
  preferredLanguage: 'ENGLISH',
};

/** Which fields must pass validation before the wizard advances past each step. */
export const STEP_FIELDS = {
  0: [
    'schoolId', 'firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth', 'admissionNumber',
    'admissionDate', 'rollNumber', 'classId', 'sectionId', 'bloodGroup', 'nationality', 'motherTongue',
  ],
  1: [
    'guardianName', 'guardianRelationship', 'guardianPhone', 'guardianAlternatePhone', 'guardianEmail',
    'guardianOccupation', 'fatherName', 'fatherMobile', 'fatherEmail', 'fatherOccupation', 'motherName',
    'motherMobile', 'motherEmail', 'motherOccupation', 'emergencyContactName', 'emergencyContactRelationship',
    'emergencyContactMobile',
  ],
  2: [
    'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'smsNotificationsEnabled',
    'whatsappNotificationsEnabled', 'emailNotificationsEnabled', 'preferredLanguage',
  ],
} as const satisfies Record<number, (keyof FormValues)[]>;

export const STEPS = [
  { title: 'Student details' },
  { title: 'Guardian & contact' },
  { title: 'Address & communication' },
  { title: 'Review' },
];
