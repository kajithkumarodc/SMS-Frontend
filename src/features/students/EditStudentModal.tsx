import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal, Select, Space, Typography } from 'antd';
import { updateStudent, type Student, type UpdateStudentInput } from '../../api/students';
import { STUDENTS_QUERY_KEY } from './queryKeys';

const { Text } = Typography;

const STATUS_OPTIONS: { value: Student['status']; label: string }[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'LEFT_SCHOOL', label: 'Left school' },
  { value: 'TRANSFERRED', label: 'Transferred' },
];

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'Keep this under 100 characters'),
  lastName: z.string().trim().min(1, 'Last name is required').max(100, 'Keep this under 100 characters'),
  guardianName: z.string().trim().max(200, 'Keep this under 200 characters').optional(),
  guardianContact: z.string().trim().max(50, 'Keep this under 50 characters').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'LEFT_SCHOOL', 'TRANSFERRED']),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  /** The student to edit; `null` keeps the modal closed. */
  student: Student | null;
  onClose: () => void;
};

function EditStudentModal({ student, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', guardianName: undefined, guardianContact: undefined, status: 'ACTIVE' },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (student) {
      reset({
        firstName: student.firstName,
        lastName: student.lastName,
        guardianName: student.guardianName ?? undefined,
        guardianContact: student.guardianContact ?? undefined,
        status: student.status,
      });
    }
  }, [student, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!student) {
        return Promise.reject(new Error('No student selected'));
      }
      // Only the fields this quick-edit form exposes are changed; every other admission-form
      // field is preserved as-is by re-sending the student's current value for it.
      const payload: UpdateStudentInput = {
        firstName: values.firstName.trim(),
        middleName: student.middleName ?? undefined,
        lastName: values.lastName.trim(),
        gender: student.gender ?? undefined,
        dateOfBirth: student.dateOfBirth ?? undefined,
        bloodGroup: student.bloodGroup ?? undefined,
        nationality: student.nationality ?? undefined,
        religion: student.religion ?? undefined,
        motherTongue: student.motherTongue ?? undefined,
        category: student.category ?? undefined,
        rollNumber: student.rollNumber ?? undefined,
        enrollmentNumber: student.enrollmentNumber ?? undefined,
        admissionDate: student.admissionDate ?? undefined,
        previousSchoolName: student.previousSchoolName ?? undefined,
        previousSchoolClass: student.previousSchoolClass ?? undefined,
        previousSchoolAdmissionNumber: student.previousSchoolAdmissionNumber ?? undefined,
        previousSchoolAddress: student.previousSchoolAddress ?? undefined,
        transferCertificateNumber: student.transferCertificateNumber ?? undefined,
        admissionSource: student.admissionSource ?? undefined,
        rteStatus: student.rteStatus,
        guardianName: values.guardianName?.trim() || undefined,
        guardianRelationship: student.guardianRelationship ?? undefined,
        guardianPhone: student.guardianPhone ?? undefined,
        guardianAlternatePhone: student.guardianAlternatePhone ?? undefined,
        guardianEmail: student.guardianEmail ?? undefined,
        guardianOccupation: student.guardianOccupation ?? undefined,
        fatherName: student.fatherName ?? undefined,
        fatherMobile: student.fatherMobile ?? undefined,
        fatherEmail: student.fatherEmail ?? undefined,
        fatherOccupation: student.fatherOccupation ?? undefined,
        motherName: student.motherName ?? undefined,
        motherMobile: student.motherMobile ?? undefined,
        motherEmail: student.motherEmail ?? undefined,
        motherOccupation: student.motherOccupation ?? undefined,
        emergencyContactName: student.emergencyContactName ?? undefined,
        emergencyContactRelationship: student.emergencyContactRelationship ?? undefined,
        emergencyContactMobile: student.emergencyContactMobile ?? undefined,
        emergencyContactAlternateMobile: student.emergencyContactAlternateMobile ?? undefined,
        emergencyContactAddress: student.emergencyContactAddress ?? undefined,
        addressLine1: student.addressLine1 ?? undefined,
        addressLine2: student.addressLine2 ?? undefined,
        city: student.city ?? undefined,
        state: student.state ?? undefined,
        currentCountry: student.currentCountry ?? undefined,
        pincode: student.pincode ?? undefined,
        permanentAddressLine1: student.permanentAddressLine1 ?? undefined,
        permanentAddressLine2: student.permanentAddressLine2 ?? undefined,
        permanentCity: student.permanentCity ?? undefined,
        permanentState: student.permanentState ?? undefined,
        permanentCountry: student.permanentCountry ?? undefined,
        permanentPincode: student.permanentPincode ?? undefined,
        familyId: student.familyId ?? undefined,
        guardianContact: values.guardianContact?.trim() || undefined,
        smsNotificationsEnabled: student.smsNotificationsEnabled,
        whatsappNotificationsEnabled: student.whatsappNotificationsEnabled,
        emailNotificationsEnabled: student.emailNotificationsEnabled,
        preferredLanguage: student.preferredLanguage,
        status: values.status,
      };
      return updateStudent(student.id, payload);
    },
    onSuccess: (updated) => {
      message.success(`${updated.fullName} updated`);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not save the changes. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title="Edit student"
      open={student !== null}
      onCancel={onClose}
      onOk={submit}
      okText="Save changes"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Form.Item label="Admission number">
          <Input value={student?.admissionNumber ?? ''} disabled />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Admission number cannot be changed — it is the student&rsquo;s permanent record key.
          </Text>
        </Form.Item>

        <Space.Compact block>
          <Controller
            control={control}
            name="firstName"
            render={({ field }) => (
              <Form.Item
                label="First name"
                required
                style={{ width: '50%' }}
                validateStatus={errors.firstName ? 'error' : undefined}
                help={errors.firstName?.message}
              >
                <Input {...field} data-testid="student-fullname-input" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field }) => (
              <Form.Item
                label="Last name"
                required
                style={{ width: '50%' }}
                validateStatus={errors.lastName ? 'error' : undefined}
                help={errors.lastName?.message}
              >
                <Input {...field} autoComplete="off" />
              </Form.Item>
            )}
          />
        </Space.Compact>

        <Controller
          control={control}
          name="guardianName"
          render={({ field }) => (
            <Form.Item
              label="Guardian name"
              validateStatus={errors.guardianName ? 'error' : undefined}
              help={errors.guardianName?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="e.g. Anil Sharma" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="guardianContact"
          render={({ field }) => (
            <Form.Item
              label="Guardian contact"
              validateStatus={errors.guardianContact ? 'error' : undefined}
              help={errors.guardianContact?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Phone or email" autoComplete="off" />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Form.Item
              label="Status"
              required
              validateStatus={errors.status ? 'error' : undefined}
              help={errors.status?.message}
            >
              <Select {...field} options={STATUS_OPTIONS} />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default EditStudentModal;
