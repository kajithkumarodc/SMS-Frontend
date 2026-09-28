import { z } from 'zod';
import dayjs from 'dayjs';

export const MOBILE_REGEX = /^\+?[0-9]{10,15}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const optionalMobile = z.string().trim().refine((v) => v === '' || MOBILE_REGEX.test(v), 'Enter 10-15 digits');
const optionalEmail = z
  .string()
  .trim()
  .max(200, 'Keep this under 200 characters')
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address');
const optionalPincode = z.string().trim().refine((v) => v === '' || PINCODE_REGEX.test(v), 'Enter a valid 6-digit PIN code');

/** Smart School's Student Admission form. Required: admission no, class, section, first name, gender, DOB, guardian. */
export const admissionSchema = z
  .object({
    admissionNumber: text(60).min(1, 'Admission No is required'),
    rollNumber: text(20),
    classId: z.string().min(1, 'Select a class'),
    sectionId: z.string().min(1, 'Select a section'),
    firstName: text(100).min(1, 'First Name is required'),
    lastName: text(100),
    gender: z.string().min(1, 'Select a gender'),
    dateOfBirth: z
      .string()
      .min(1, 'Date Of Birth is required')
      .refine((v) => !v || dayjs(v).isBefore(dayjs(), 'day'), 'Date of birth must be in the past'),
    category: text(50),
    religion: text(100),
    caste: text(100),
    mobileNumber: optionalMobile,
    email: optionalEmail,
    mediumId: z.string(),
    admissionDate: z.string(),
    bloodGroup: z.string(),
    height: text(20),
    weight: text(20),
    measurementDate: z.string(),
    siblingId: z.string(),
    medicalHistory: text(4000),

    routeId: z.string(),
    hostelBlockId: z.string(),
    hostelRoomId: z.string(),

    fatherName: text(200),
    fatherPhone: optionalMobile,
    fatherOccupation: text(200),
    motherName: text(200),
    motherPhone: optionalMobile,
    motherOccupation: text(200),
    guardianIs: z.enum(['FATHER', 'MOTHER', 'OTHER'], { required_error: 'Choose who the guardian is' }),
    guardianName: text(200).min(1, 'Guardian Name is required'),
    guardianRelation: z.string(),
    guardianEmail: optionalEmail,
    guardianPhone: z.string().trim().min(1, 'Guardian Phone is required').regex(MOBILE_REGEX, 'Enter 10-15 digits'),
    guardianOccupation: text(200),
    guardianAddress: text(1000),

    guardianAddressIsCurrent: z.boolean(),
    permanentSameAsCurrent: z.boolean(),
    addressLine1: text(255),
    addressLine2: text(255),
    city: text(100),
    state: text(100),
    pincode: optionalPincode,
    permanentAddressLine1: text(255),
    permanentAddressLine2: text(255),
    permanentCity: text(100),
    permanentState: text(100),
    permanentPincode: optionalPincode,

    bankAccountNumber: text(40),
    bankName: text(150),
    ifscCode: text(20),
    nationalId: text(200),
    localId: text(200),
    rte: z.boolean(),
    previousSchool: text(200),
    note: text(4000),
  })
  .refine((v) => v.guardianIs !== 'OTHER' || v.guardianRelation !== '', {
    path: ['guardianRelation'],
    message: 'Choose the relation',
  });

export type AdmissionValues = z.infer<typeof admissionSchema>;

export function emptyAdmission(): AdmissionValues {
  return {
    admissionNumber: '',
    rollNumber: '',
    classId: '',
    sectionId: '',
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    category: '',
    religion: '',
    caste: '',
    mobileNumber: '',
    email: '',
    mediumId: '',
    admissionDate: dayjs().format('YYYY-MM-DD'),
    bloodGroup: '',
    height: '',
    weight: '',
    measurementDate: dayjs().format('YYYY-MM-DD'),
    siblingId: '',
    medicalHistory: '',
    routeId: '',
    hostelBlockId: '',
    hostelRoomId: '',
    fatherName: '',
    fatherPhone: '',
    fatherOccupation: '',
    motherName: '',
    motherPhone: '',
    motherOccupation: '',
    guardianIs: undefined as unknown as AdmissionValues['guardianIs'],
    guardianName: '',
    guardianRelation: '',
    guardianEmail: '',
    guardianPhone: '',
    guardianOccupation: '',
    guardianAddress: '',
    guardianAddressIsCurrent: false,
    permanentSameAsCurrent: false,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    permanentAddressLine1: '',
    permanentAddressLine2: '',
    permanentCity: '',
    permanentState: '',
    permanentPincode: '',
    bankAccountNumber: '',
    bankName: '',
    ifscCode: '',
    nationalId: '',
    localId: '',
    rte: false,
    previousSchool: '',
    note: '',
  };
}

/** Fields that live inside the collapsed "Add More Details" panel -- opened automatically when one is invalid. */
export const MORE_DETAILS_FIELDS: (keyof AdmissionValues)[] = [
  'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'permanentAddressLine1', 'permanentAddressLine2',
  'permanentCity', 'permanentState', 'permanentPincode', 'bankAccountNumber', 'bankName', 'ifscCode', 'nationalId',
  'localId', 'previousSchool', 'note',
];
