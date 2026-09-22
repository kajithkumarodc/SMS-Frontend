import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Form, Modal, Space, Steps, theme } from 'antd';
import {
  createStudent,
  DuplicateAdmissionNumberError,
  fetchSchools,
  fetchStudents,
  type CreateStudentInput,
} from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { STUDENTS_QUERY_KEY } from '../queryKeys';
import { EMPTY_FORM, schema, STEP_FIELDS, STEPS, type FormValues } from './schema';
import { combineFullName, computeAcademicYear, findSimilarStudentName, suggestAdmissionNumber } from './helpers';
import StudentDetailsStep from './StudentDetailsStep';
import GuardianStep from './GuardianStep';
import AddressStep from './AddressStep';
import ReviewStep from './ReviewStep';

type Props = {
  open: boolean;
  onClose: () => void;
};

function AddStudentModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [pendingAction, setPendingAction] = useState<'close' | 'another' | null>(null);
  const admissionNumberEditedRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
    mode: 'onTouched',
  });

  const schoolsQuery = useQuery({
    queryKey: ['schools'],
    queryFn: fetchSchools,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const classesQuery = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Powers both the admission-number suggestion and the duplicate-name warning
  // below. One fetch per time the modal opens; refreshed on each new open so a
  // student added a minute ago is already accounted for.
  const lookupQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, 'add-wizard-lookup'],
    queryFn: () => fetchStudents({ page: 0, size: 500 }),
    enabled: open,
    staleTime: 30 * 1000,
  });
  const knownStudents = useMemo(() => lookupQuery.data?.content ?? [], [lookupQuery.data]);
  const classes = classesQuery.data ?? [];

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM);
      setStep(0);
      admissionNumberEditedRef.current = false;
    }
  }, [open, reset]);

  const values = watch();
  const combinedFullName = combineFullName(values.firstName, values.middleName, values.lastName);
  const debouncedFullName = useDebouncedValue(combinedFullName, 400);
  const academicYear = useMemo(() => computeAcademicYear(), []);

  useEffect(() => {
    if (!values.schoolId || admissionNumberEditedRef.current) return;
    setValue('admissionNumber', suggestAdmissionNumber(knownStudents), {
      shouldValidate: false,
    });
    // Re-runs when the school changes or the lookup list arrives/updates; the
    // "has the user typed their own number" guard is a ref, not a dependency.
  }, [values.schoolId, knownStudents, setValue]);

  const similarName = useMemo(
    () => findSimilarStudentName(knownStudents, debouncedFullName, values.schoolId),
    [knownStudents, debouncedFullName, values.schoolId],
  );

  const mutation = useMutation({
    mutationFn: (formValues: FormValues) => {
      const payload: CreateStudentInput = {
        schoolId: formValues.schoolId,
        firstName: formValues.firstName.trim(),
        middleName: formValues.middleName?.trim() || undefined,
        lastName: formValues.lastName.trim(),
        gender: formValues.gender,
        dateOfBirth: formValues.dateOfBirth,
        admissionNumber: formValues.admissionNumber.trim(),
        admissionDate: formValues.admissionDate,
        rollNumber: formValues.rollNumber?.trim() || undefined,
        sectionId: formValues.sectionId,
        bloodGroup: formValues.bloodGroup,
        nationality: formValues.nationality?.trim() || undefined,
        motherTongue: formValues.motherTongue?.trim() || undefined,

        guardianName: formValues.guardianName.trim(),
        guardianRelationship: formValues.guardianRelationship,
        guardianPhone: formValues.guardianPhone.trim(),
        guardianAlternatePhone: formValues.guardianAlternatePhone?.trim() || undefined,
        guardianEmail: formValues.guardianEmail?.trim() || undefined,
        guardianOccupation: formValues.guardianOccupation?.trim() || undefined,

        fatherName: formValues.fatherName?.trim() || undefined,
        fatherMobile: formValues.fatherMobile?.trim() || undefined,
        fatherEmail: formValues.fatherEmail?.trim() || undefined,
        fatherOccupation: formValues.fatherOccupation?.trim() || undefined,
        motherName: formValues.motherName?.trim() || undefined,
        motherMobile: formValues.motherMobile?.trim() || undefined,
        motherEmail: formValues.motherEmail?.trim() || undefined,
        motherOccupation: formValues.motherOccupation?.trim() || undefined,

        emergencyContactName: formValues.emergencyContactName?.trim() || undefined,
        emergencyContactRelationship: formValues.emergencyContactRelationship,
        emergencyContactMobile: formValues.emergencyContactMobile?.trim() || undefined,

        addressLine1: formValues.addressLine1.trim(),
        addressLine2: formValues.addressLine2?.trim() || undefined,
        city: formValues.city.trim(),
        state: formValues.state.trim(),
        pincode: formValues.pincode.trim(),

        smsNotificationsEnabled: formValues.smsNotificationsEnabled,
        whatsappNotificationsEnabled: formValues.whatsappNotificationsEnabled,
        emailNotificationsEnabled: formValues.emailNotificationsEnabled,
        preferredLanguage: formValues.preferredLanguage,
      };
      return createStudent(payload);
    },
    onError: (error) => {
      if (error instanceof DuplicateAdmissionNumberError) {
        setError('admissionNumber', { type: 'server', message: error.message });
        setStep(0);
        return;
      }
      message.error('Could not add the student. Please try again.');
    },
    onSettled: () => setPendingAction(null),
  });

  const goNext = async () => {
    const fieldsToCheck = STEP_FIELDS[step as 0 | 1 | 2];
    const valid = await trigger(fieldsToCheck);
    if (valid) setStep((current) => current + 1);
  };
  const goBack = () => setStep((current) => Math.max(0, current - 1));

  const submitAndClose = handleSubmit((formValues) => {
    setPendingAction('close');
    mutation.mutate(formValues, {
      onSuccess: (student) => {
        message.success(`${student.fullName} added`);
        void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
        onClose();
      },
    });
  });

  const submitAndAddAnother = handleSubmit((formValues) => {
    setPendingAction('another');
    mutation.mutate(formValues, {
      onSuccess: (student) => {
        message.success(`${student.fullName} added — ready for the next one`);
        void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
        reset(EMPTY_FORM);
        admissionNumberEditedRef.current = false;
        setStep(0);
      },
    });
  });

  const schoolOptions = (schoolsQuery.data ?? []).map((school) => ({
    value: school.id,
    label: school.name,
  }));
  const noSchools = schoolsQuery.isSuccess && schoolOptions.length === 0;
  const schoolName = schoolOptions.find((school) => school.value === values.schoolId)?.label;
  const selectedClass = classes.find((cls) => cls.id === values.classId);
  const className = selectedClass?.name;
  const sectionName = selectedClass?.sections.find((section) => section.id === values.sectionId)?.name;

  return (
    <Modal
      title="Add student"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {schoolsQuery.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: token.marginMD }}
          message="Couldn't load the school list"
          description="Try reopening this dialog. If it keeps failing, the schools endpoint may be unavailable."
        />
      )}
      {noSchools && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: token.marginMD }}
          message="No schools found for your account"
          description="A student must belong to a school. Ask an administrator to set one up first."
        />
      )}

      <Steps current={step} items={STEPS} size="small" style={{ marginBottom: token.marginLG }} />

      <Form layout="vertical">
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
          <StudentDetailsStep
            control={control}
            errors={errors}
            setValue={setValue}
            schoolOptions={schoolOptions}
            schoolsLoading={schoolsQuery.isLoading}
            classes={classes}
            selectedSchoolId={values.schoolId}
            selectedClassId={values.classId}
            similarName={similarName}
            academicYear={academicYear}
            onAdmissionNumberEdited={() => {
              admissionNumberEditedRef.current = true;
            }}
          />
        </div>

        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <GuardianStep control={control} errors={errors} />
        </div>

        <div style={{ display: step === 2 ? 'block' : 'none' }}>
          <AddressStep control={control} errors={errors} />
        </div>
      </Form>

      {step === 3 && (
        <ReviewStep
          values={values}
          schoolName={schoolName}
          className={className}
          sectionName={sectionName}
          academicYear={academicYear}
          onEditStep={setStep}
        />
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: token.marginLG,
          paddingTop: token.marginMD,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Button onClick={step === 0 ? onClose : goBack} disabled={mutation.isPending}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {step < 3 ? (
          <Button
            type="primary"
            onClick={() => void goNext()}
            disabled={schoolsQuery.isLoading || noSchools}
          >
            Next
          </Button>
        ) : (
          <Space>
            <Button
              onClick={() => void submitAndAddAnother()}
              loading={mutation.isPending && pendingAction === 'another'}
              disabled={mutation.isPending && pendingAction === 'close'}
            >
              Save and add another
            </Button>
            <Button
              type="primary"
              onClick={() => void submitAndClose()}
              loading={mutation.isPending && pendingAction === 'close'}
              disabled={mutation.isPending && pendingAction === 'another'}
            >
              Add student
            </Button>
          </Space>
        )}
      </div>
    </Modal>
  );
}

export default AddStudentModal;
