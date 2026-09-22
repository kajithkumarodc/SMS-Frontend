import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Input,
  Result,
  Select,
  Skeleton,
  Space,
  Steps,
  Typography,
  Upload,
  theme,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchPublicClasses,
  fetchPublicOpenCycle,
  fetchPublicSchools,
  submitPublicApplication,
  uploadPublicApplicationDocument,
  type SubmitApplicationInput,
} from '../../api/admissions';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),

  guardianName: z.string().trim().max(200).optional(),
  guardianRelationship: z.string().optional(),
  guardianPhone: z.string().trim().max(20).optional(),
  guardianEmail: z.string().trim().min(1, 'Guardian email is required').email('Enter a valid email').max(200),
  guardianOccupation: z.string().trim().max(200).optional(),

  applyingClassId: z.string().optional(),
  previousSchoolName: z.string().trim().max(200).optional(),
  previousSchoolClass: z.string().trim().max(50).optional(),
  addressLine1: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  pincode: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  guardianEmail: '',
};

const STEP_FIELDS: (keyof FormValues)[][] = [
  ['firstName', 'middleName', 'lastName', 'dateOfBirth', 'gender', 'bloodGroup', 'nationality', 'category'],
  ['guardianName', 'guardianRelationship', 'guardianPhone', 'guardianEmail', 'guardianOccupation'],
  ['applyingClassId', 'previousSchoolName', 'previousSchoolClass', 'addressLine1', 'city', 'state', 'country', 'pincode'],
  [],
];

function AdmissionApplyPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [schoolId, setSchoolId] = useState<string | undefined>();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState<{ applicationNumber: string; guardianEmail: string } | null>(null);

  const schoolsQuery = useQuery({ queryKey: ['public-schools'], queryFn: fetchPublicSchools });
  const cycleQuery = useQuery({
    queryKey: ['public-open-cycle', schoolId],
    queryFn: () => fetchPublicOpenCycle(schoolId as string),
    enabled: Boolean(schoolId),
    retry: false,
  });
  const classesQuery = useQuery({
    queryKey: ['public-classes', schoolId],
    queryFn: () => fetchPublicClasses(schoolId as string),
    enabled: Boolean(schoolId),
  });

  useEffect(() => {
    if (!schoolId && schoolsQuery.data?.length === 1) {
      setSchoolId(schoolsQuery.data[0].id);
    }
  }, [schoolId, schoolsQuery.data]);

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  const submitMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: SubmitApplicationInput = {
        admissionCycleId: cycleQuery.data!.id,
        firstName: values.firstName.trim(),
        middleName: values.middleName?.trim() || null,
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth,
        gender: values.gender || null,
        bloodGroup: values.bloodGroup || null,
        nationality: values.nationality?.trim() || null,
        category: values.category?.trim() || null,
        applyingClassId: values.applyingClassId || null,
        previousSchoolName: values.previousSchoolName?.trim() || null,
        previousSchoolClass: values.previousSchoolClass?.trim() || null,
        guardianName: values.guardianName?.trim() || null,
        guardianRelationship: values.guardianRelationship || null,
        guardianPhone: values.guardianPhone?.trim() || null,
        guardianEmail: values.guardianEmail.trim(),
        guardianOccupation: values.guardianOccupation?.trim() || null,
        addressLine1: values.addressLine1?.trim() || null,
        city: values.city?.trim() || null,
        state: values.state?.trim() || null,
        country: values.country?.trim() || null,
        pincode: values.pincode?.trim() || null,
      };
      return submitPublicApplication(input);
    },
    onSuccess: (result) => {
      setSubmitted({ applicationNumber: result.applicationNumber, guardianEmail: getValues('guardianEmail').trim() });
    },
    onError: () => message.error('Could not submit the application. Please check the form and try again.'),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, documentType }: { file: File; documentType: string }) =>
      uploadPublicApplicationDocument(submitted!.applicationNumber, submitted!.guardianEmail, documentType, file),
    onSuccess: () => message.success('Document uploaded'),
    onError: () => message.error('Could not upload this file.'),
  });

  const next = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: token.paddingLG, background: token.colorBgLayout }}>
        <Card style={{ width: '100%', maxWidth: 560, alignSelf: 'flex-start', marginTop: token.marginXL, boxShadow: token.boxShadowTertiary }}>
          <Result
            status="success"
            title="Application submitted successfully."
            subTitle={
              <>
                Your application reference:{' '}
                <Text strong copyable data-testid="admission-reference-number">
                  {submitted.applicationNumber}
                </Text>
                <br />
                Keep this reference and the email you applied with -- you will need both to check your status.
              </>
            }
          />
          <Divider>Upload supporting documents (optional)</Divider>
          <DocumentUploadWidget onUpload={(file, documentType) => uploadMutation.mutate({ file, documentType })} busy={uploadMutation.isPending} />
          <div style={{ textAlign: 'center', marginTop: token.marginLG }}>
            <Link to="/admissions/status">Check application status</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: token.paddingLG, background: token.colorBgLayout }}>
      <Card style={{ width: '100%', maxWidth: 720, alignSelf: 'flex-start', marginTop: token.marginXL, boxShadow: token.boxShadowTertiary }}>
        <Title level={3} style={{ marginTop: 0 }}>
          Online Admission Application
        </Title>

        <Space direction="vertical" style={{ width: '100%', marginBottom: token.marginLG }}>
          <Text strong>School</Text>
          <Select
            data-testid="admission-school-select"
            style={{ width: '100%' }}
            placeholder="Select a school"
            loading={schoolsQuery.isLoading}
            options={(schoolsQuery.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={schoolId}
            onChange={(v) => setSchoolId(v)}
          />
        </Space>

        {!schoolId ? (
          <Empty description="Select a school to continue" />
        ) : cycleQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : cycleQuery.isError ? (
          <Alert type="warning" showIcon message="Online admissions are currently closed" description="There is no open admission cycle for this school right now. Please check back later." />
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: token.marginLG }}
              message={cycleQuery.data?.name}
              description={`Applications close ${cycleQuery.data?.closeDate}.`}
            />

            <Steps
              current={step}
              size="small"
              style={{ marginBottom: token.marginLG }}
              items={[{ title: 'Student' }, { title: 'Guardian' }, { title: 'Admission details' }, { title: 'Review & submit' }]}
            />

            <Form_ hidden={step !== 0}>
              <Space.Compact block>
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field }) => (
                    <FieldItem label="First name" required style={{ width: '34%' }} error={errors.firstName?.message}>
                      <Input {...field} data-testid="admission-firstname-input" />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="middleName"
                  render={({ field }) => (
                    <FieldItem label="Middle name" style={{ width: '32%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field }) => (
                    <FieldItem label="Last name" required style={{ width: '34%' }} error={errors.lastName?.message}>
                      <Input {...field} data-testid="admission-lastname-input" />
                    </FieldItem>
                  )}
                />
              </Space.Compact>
              <Space.Compact block>
                <Controller
                  control={control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FieldItem label="Date of birth" required style={{ width: '34%' }} error={errors.dateOfBirth?.message}>
                      <DatePicker
                        data-testid="admission-dob-input"
                        style={{ width: '100%' }}
                        value={field.value ? dayjs(field.value) : null}
                        onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
                      />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <FieldItem label="Gender" style={{ width: '32%' }}>
                      <Select {...field} allowClear options={[{ value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' }, { value: 'OTHER', label: 'Other' }]} />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FieldItem label="Blood group" style={{ width: '34%' }}>
                      <Select {...field} allowClear options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v }))} />
                    </FieldItem>
                  )}
                />
              </Space.Compact>
              <Space.Compact block>
                <Controller
                  control={control}
                  name="nationality"
                  render={({ field }) => (
                    <FieldItem label="Nationality" style={{ width: '50%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <FieldItem label="Category" style={{ width: '50%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
              </Space.Compact>
            </Form_>

            <Form_ hidden={step !== 1}>
              <Controller
                control={control}
                name="guardianName"
                render={({ field }) => (
                  <FieldItem label="Parent / guardian name">
                    <Input {...field} />
                  </FieldItem>
                )}
              />
              <Space.Compact block>
                <Controller
                  control={control}
                  name="guardianRelationship"
                  render={({ field }) => (
                    <FieldItem label="Relationship" style={{ width: '50%' }}>
                      <Select {...field} allowClear options={['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'].map((v) => ({ value: v, label: v }))} />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="guardianPhone"
                  render={({ field }) => (
                    <FieldItem label="Phone" style={{ width: '50%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
              </Space.Compact>
              <Controller
                control={control}
                name="guardianEmail"
                render={({ field }) => (
                  <FieldItem label="Guardian email" required error={errors.guardianEmail?.message} help="You'll use this, together with your reference number, to check your application status.">
                    <Input {...field} data-testid="admission-guardian-email-input" />
                  </FieldItem>
                )}
              />
              <Controller
                control={control}
                name="guardianOccupation"
                render={({ field }) => (
                  <FieldItem label="Occupation">
                    <Input {...field} />
                  </FieldItem>
                )}
              />
            </Form_>

            <Form_ hidden={step !== 2}>
              <Controller
                control={control}
                name="applyingClassId"
                render={({ field }) => (
                  <FieldItem label="Applying for class / grade">
                    <Select {...field} allowClear loading={classesQuery.isLoading} options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
                  </FieldItem>
                )}
              />
              <Space.Compact block>
                <Controller
                  control={control}
                  name="previousSchoolName"
                  render={({ field }) => (
                    <FieldItem label="Previous school" style={{ width: '65%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
                <Controller
                  control={control}
                  name="previousSchoolClass"
                  render={({ field }) => (
                    <FieldItem label="Previous class" style={{ width: '35%' }}>
                      <Input {...field} />
                    </FieldItem>
                  )}
                />
              </Space.Compact>
              <Controller
                control={control}
                name="addressLine1"
                render={({ field }) => (
                  <FieldItem label="Address">
                    <Input {...field} />
                  </FieldItem>
                )}
              />
              <Space.Compact block>
                <Controller control={control} name="city" render={({ field }) => (
                  <FieldItem label="City" style={{ width: '25%' }}><Input {...field} /></FieldItem>
                )} />
                <Controller control={control} name="state" render={({ field }) => (
                  <FieldItem label="State" style={{ width: '25%' }}><Input {...field} /></FieldItem>
                )} />
                <Controller control={control} name="country" render={({ field }) => (
                  <FieldItem label="Country" style={{ width: '25%' }}><Input {...field} /></FieldItem>
                )} />
                <Controller control={control} name="pincode" render={({ field }) => (
                  <FieldItem label="PIN code" style={{ width: '25%' }}><Input {...field} /></FieldItem>
                )} />
              </Space.Compact>
            </Form_>

            {step === 3 && (
              <Descriptions column={2} size="small" bordered style={{ marginBottom: token.marginLG }}>
                <Descriptions.Item label="Student" span={2}>
                  {[getValues('firstName'), getValues('middleName'), getValues('lastName')].filter(Boolean).join(' ')}
                </Descriptions.Item>
                <Descriptions.Item label="Date of birth">{getValues('dateOfBirth')}</Descriptions.Item>
                <Descriptions.Item label="Applying for">{classesQuery.data?.find((c) => c.id === getValues('applyingClassId'))?.name ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Guardian" span={2}>
                  {getValues('guardianName') || '—'} ({getValues('guardianEmail')})
                </Descriptions.Item>
              </Descriptions>
            )}

            <Space style={{ marginTop: token.marginLG }}>
              {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>Back</Button>}
              {step < 3 && (
                <Button type="primary" onClick={next}>
                  Next
                </Button>
              )}
              {step === 3 && (
                <Button type="primary" loading={submitMutation.isPending} onClick={handleSubmit((values) => submitMutation.mutate(values))}>
                  Submit application
                </Button>
              )}
            </Space>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: token.marginXL }}>
          <Link to="/admissions/status">Already applied? Check your status</Link>
        </div>
      </Card>
    </div>
  );
}

function Form_({ children, hidden }: { children: React.ReactNode; hidden: boolean }) {
  return <div style={{ display: hidden ? 'none' : 'block' }}>{children}</div>;
}

function FieldItem({
  label,
  required,
  error,
  help,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  help?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <Text style={{ display: 'block', marginBottom: 4 }}>
        {label}
        {required && <Text type="danger"> *</Text>}
      </Text>
      {children}
      {(error || help) && (
        <Text type={error ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
          {error || help}
        </Text>
      )}
    </div>
  );
}

const DOCUMENT_TYPES = ['BIRTH_CERTIFICATE', 'PREVIOUS_SCHOOL_REPORT', 'TRANSFER_CERTIFICATE', 'STUDENT_PHOTO', 'IDENTITY_DOCUMENT', 'OTHER'];

function DocumentUploadWidget({ onUpload, busy }: { onUpload: (file: File, documentType: string) => void; busy: boolean }) {
  const [documentType, setDocumentType] = useState('OTHER');
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Select value={documentType} onChange={setDocumentType} style={{ width: '100%' }} options={DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))} />
      <Dragger
        multiple={false}
        showUploadList={false}
        disabled={busy}
        customRequest={({ file, onSuccess }) => {
          onUpload(file as File, documentType);
          onSuccess?.({});
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag a file to upload</p>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          PDF, JPG, PNG, WEBP, DOC or DOCX, max 10MB
        </Paragraph>
      </Dragger>
    </Space>
  );
}

export default AdmissionApplyPage;
