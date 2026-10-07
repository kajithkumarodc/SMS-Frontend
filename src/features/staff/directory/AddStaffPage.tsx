import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  theme,
} from 'antd';
import { ArrowLeftOutlined, CopyOutlined, DeleteOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createStaffMember,
  fetchStaffMember,
  fetchStaffOptions,
  removeStaffDocument,
  removeStaffPhoto,
  STAFF_DOCUMENT_KINDS,
  staffPhotoUrl,
  updateStaffMember,
  uploadStaffDocument,
  uploadStaffPhoto,
  type StaffDocumentKind,
  type StaffInput,
  type StaffMember,
} from '../../../api/staffMembers';
import { useAuthStore } from '../../../store/authStore';
import { hasPermission } from '../../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, uploadProblem } from '../../../lib/files';
import FilePicker from '../../students/admission/FilePicker';
import { STAFF_DIRECTORY_KEY, STAFF_MEMBER_KEY, STAFF_OPTIONS_KEY } from './queryKeys';
import { CONTRACT_TYPE_OPTIONS, GENDER_OPTIONS, MARITAL_STATUS_OPTIONS } from './options';

const { Title, Text } = Typography;

const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;
const SALARY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid phone number');
const leave = z.number().int('Whole days only').min(0, 'Cannot be negative').nullable();

const schema = z.object({
  staffId: z.string().trim().min(1, 'Staff ID is required').max(50, 'Keep this under 50 characters'),
  roleId: z.string().min(1, 'Role is required'),
  designationId: z.string(),
  departmentId: z.string(),
  firstName: z.string().trim().min(1, 'First name is required').max(100, 'Keep this under 100 characters'),
  lastName: optionalText(100),
  fatherName: optionalText(200),
  motherName: optionalText(200),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').max(320),
  gender: z.string().min(1, 'Gender is required'),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((v) => dayjs(v).isBefore(dayjs(), 'day'), 'Date of birth must be in the past'),
  dateOfJoining: z.string(),
  phone: optionalPhone,
  emergencyContactNumber: optionalPhone,
  maritalStatus: z.string(),
  currentAddress: optionalText(500),
  permanentAddress: optionalText(500),
  qualification: optionalText(500),
  workExperience: optionalText(500),
  note: z.string().max(2000, 'Keep this under 2000 characters'),
  panNumber: z.string().trim().min(1, 'PAN number is required').max(20, 'Keep this under 20 characters'),
  epfNo: optionalText(50),
  basicSalary: z
    .string()
    .trim()
    .refine((v) => v === '' || SALARY_PATTERN.test(v), 'Enter an amount with at most 2 decimal places'),
  contractType: z.string(),
  workShift: optionalText(100),
  workLocation: optionalText(100),
  medicalLeave: leave,
  casualLeave: leave,
  maternityLeave: leave,
  sickLeave: leave,
  mandatoryLeave: leave,
  accountTitle: optionalText(200),
  bankAccountNumber: optionalText(40),
  bankName: optionalText(150),
  ifscCode: optionalText(20),
  bankBranchName: optionalText(150),
  facebookUrl: optionalText(300),
  twitterUrl: optionalText(300),
  linkedinUrl: optionalText(300),
  instagramUrl: optionalText(300),
});

type FormValues = z.infer<typeof schema>;
type TextField = { [K in keyof FormValues]: FormValues[K] extends string ? K : never }[keyof FormValues];
type LeaveField = 'medicalLeave' | 'casualLeave' | 'maternityLeave' | 'sickLeave' | 'mandatoryLeave';

function emptyForm(): FormValues {
  return {
    staffId: '', roleId: '', designationId: '', departmentId: '', firstName: '', lastName: '', fatherName: '',
    motherName: '', email: '', gender: '', dateOfBirth: '', dateOfJoining: '', phone: '', emergencyContactNumber: '',
    maritalStatus: '', currentAddress: '', permanentAddress: '', qualification: '', workExperience: '', note: '',
    panNumber: '', epfNo: '', basicSalary: '', contractType: '', workShift: '', workLocation: '', medicalLeave: null,
    casualLeave: null, maternityLeave: null, sickLeave: null, mandatoryLeave: null, accountTitle: '',
    bankAccountNumber: '', bankName: '', ifscCode: '', bankBranchName: '', facebookUrl: '', twitterUrl: '',
    linkedinUrl: '', instagramUrl: '',
  };
}

function fromStaff(s: StaffMember): FormValues {
  return {
    staffId: s.staffId,
    roleId: s.roleId ?? '',
    designationId: s.designationId ?? '',
    departmentId: s.departmentId ?? '',
    firstName: s.firstName ?? s.fullName,
    lastName: s.lastName ?? '',
    fatherName: s.fatherName ?? '',
    motherName: s.motherName ?? '',
    email: s.email,
    gender: s.gender ?? '',
    dateOfBirth: s.dateOfBirth ?? '',
    dateOfJoining: s.dateOfJoining ?? '',
    phone: s.phone ?? '',
    emergencyContactNumber: s.emergencyContactNumber ?? '',
    maritalStatus: s.maritalStatus ?? '',
    currentAddress: s.currentAddress ?? '',
    permanentAddress: s.permanentAddress ?? '',
    qualification: s.qualification ?? '',
    workExperience: s.workExperience ?? '',
    note: s.note ?? '',
    panNumber: s.panNumber ?? '',
    epfNo: s.epfNo ?? '',
    basicSalary: s.basicSalary === null ? '' : String(s.basicSalary),
    contractType: s.contractType ?? '',
    workShift: s.workShift ?? '',
    workLocation: s.workLocation ?? '',
    medicalLeave: s.medicalLeave,
    casualLeave: s.casualLeave,
    maternityLeave: s.maternityLeave,
    sickLeave: s.sickLeave,
    mandatoryLeave: s.mandatoryLeave,
    accountTitle: s.accountTitle ?? '',
    bankAccountNumber: s.bankAccountNumber ?? '',
    bankName: s.bankName ?? '',
    ifscCode: s.ifscCode ?? '',
    bankBranchName: s.bankBranchName ?? '',
    facebookUrl: s.facebookUrl ?? '',
    twitterUrl: s.twitterUrl ?? '',
    linkedinUrl: s.linkedinUrl ?? '',
    instagramUrl: s.instagramUrl ?? '',
  };
}

function toInput(v: FormValues): StaffInput {
  const orNull = (s: string) => s.trim() || null;
  return {
    staffId: v.staffId.trim(),
    roleId: v.roleId,
    designationId: v.designationId || null,
    departmentId: v.departmentId || null,
    firstName: v.firstName.trim(),
    lastName: orNull(v.lastName),
    fatherName: orNull(v.fatherName),
    motherName: orNull(v.motherName),
    email: v.email.trim(),
    gender: v.gender,
    dateOfBirth: v.dateOfBirth,
    dateOfJoining: v.dateOfJoining || null,
    phone: orNull(v.phone),
    emergencyContactNumber: orNull(v.emergencyContactNumber),
    maritalStatus: v.maritalStatus || null,
    currentAddress: orNull(v.currentAddress),
    permanentAddress: orNull(v.permanentAddress),
    qualification: orNull(v.qualification),
    workExperience: orNull(v.workExperience),
    note: orNull(v.note),
    panNumber: v.panNumber.trim(),
    epfNo: orNull(v.epfNo),
    basicSalary: v.basicSalary.trim() ? Number(v.basicSalary.trim()) : null,
    contractType: v.contractType || null,
    workShift: orNull(v.workShift),
    workLocation: orNull(v.workLocation),
    medicalLeave: v.medicalLeave,
    casualLeave: v.casualLeave,
    maternityLeave: v.maternityLeave,
    sickLeave: v.sickLeave,
    mandatoryLeave: v.mandatoryLeave,
    accountTitle: orNull(v.accountTitle),
    bankAccountNumber: orNull(v.bankAccountNumber),
    bankName: orNull(v.bankName),
    ifscCode: orNull(v.ifscCode),
    bankBranchName: orNull(v.bankBranchName),
    facebookUrl: orNull(v.facebookUrl),
    twitterUrl: orNull(v.twitterUrl),
    linkedinUrl: orNull(v.linkedinUrl),
    instagramUrl: orNull(v.instagramUrl),
  };
}

const sectionHeader = (text: string, token: ReturnType<typeof theme.useToken>['token']) => (
  <div style={{ background: token.colorFillTertiary, padding: `${token.paddingSM}px ${token.paddingMD}px`, margin: `0 -${token.paddingMD}px ${token.marginMD}px` }}>
    <Title level={5} style={{ margin: 0, fontWeight: 500 }}>
      {text}
    </Title>
  </div>
);

type Pending = { photo: File | null; documents: Partial<Record<StaffDocumentKind, File>> };

/** Human Resource -> Staff Directory -> Add Staff (and Edit Staff when the route has an :id). */
function AddStaffPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { staffId: editingId } = useParams<{ staffId: string }>();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const isEdit = Boolean(editingId);
  const canSave = hasPermission(permissions, isEdit ? 'STAFF_EDIT' : 'STAFF_CREATE');
  const canImport = hasPermission(permissions, 'STAFF_CREATE');

  const [pending, setPending] = useState<Pending>({ photo: null, documents: {} });
  const [removePhoto, setRemovePhoto] = useState(false);
  const [removeDocuments, setRemoveDocuments] = useState<StaffDocumentKind[]>([]);

  const optionsQuery = useQuery({ queryKey: STAFF_OPTIONS_KEY, queryFn: fetchStaffOptions, enabled: canSave });
  const staffQuery = useQuery({
    queryKey: [...STAFF_MEMBER_KEY, editingId],
    queryFn: () => fetchStaffMember(editingId as string),
    enabled: canSave && isEdit,
  });
  const existing = staffQuery.data;

  const {
    control,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm(), mode: 'onTouched' });

  useEffect(() => {
    if (existing) {
      reset(fromStaff(existing));
      setPending({ photo: null, documents: {} });
      setRemovePhoto(false);
      setRemoveDocuments([]);
    }
  }, [existing, reset]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const input = toInput(values);
      let temporaryPassword: string | null = null;
      let staff: StaffMember;
      if (existing) {
        staff = await updateStaffMember(existing.id, input);
      } else {
        const created = await createStaffMember(input);
        staff = created.staff;
        temporaryPassword = created.temporaryPassword;
      }
      // The record is saved; files go up one by one and a failure only warns, so nothing is lost or re-created.
      const problems: string[] = [];
      const attempt = async (label: string, action: () => Promise<unknown>) => {
        try {
          await action();
        } catch (error) {
          problems.push(`${label}: ${serverMessage(error) ?? 'could not be saved'}`);
        }
      };
      if (removePhoto && existing?.hasPhoto && !pending.photo) await attempt('Photo', () => removeStaffPhoto(staff.id));
      if (pending.photo) await attempt('Photo', () => uploadStaffPhoto(staff.id, pending.photo as File));
      for (const kind of removeDocuments) {
        if (!pending.documents[kind]) await attempt(kind, () => removeStaffDocument(staff.id, kind));
      }
      for (const { kind, title } of STAFF_DOCUMENT_KINDS) {
        const file = pending.documents[kind];
        if (file) await attempt(title, () => uploadStaffDocument(staff.id, kind, file));
      }
      return { staff, temporaryPassword, problems };
    },
    onSuccess: ({ staff, temporaryPassword, problems }) => {
      void queryClient.invalidateQueries({ queryKey: STAFF_DIRECTORY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...STAFF_MEMBER_KEY, staff.id] });
      const goToDirectory = () => navigate('/app/human-resource/staff-directory');
      if (problems.length > 0) {
        message.warning(`${staff.fullName} saved, but some files weren't: ${problems.join('; ')}. Open the staff profile to try again.`, 8);
      }
      if (temporaryPassword) {
        modal.success({
          title: `${staff.fullName} was added`,
          width: 480,
          okText: 'Done',
          content: (
            <div>
              <p style={{ marginTop: 0 }}>
                Give these login details to the staff member. The password is shown only now, and they must change it at first sign-in.
              </p>
              <Space direction="vertical" size={token.marginXXS} style={{ width: '100%' }}>
                <Text>
                  Username: <Text strong copyable>{staff.email}</Text>
                </Text>
                <Text>
                  Temporary password: <Text strong code copyable={{ icon: <CopyOutlined /> }}>{temporaryPassword}</Text>
                </Text>
              </Space>
            </div>
          ),
          onOk: goToDirectory,
        });
      } else {
        message.success(`${staff.fullName} updated`);
        goToDirectory();
      }
    },
    onError: (error) => message.error(serverMessage(error) ?? 'Could not save the staff member. Please try again.'),
  });

  if (!canSave) {
    return <Result status="403" title="Not available" subTitle={`You don't have permission to ${isEdit ? 'edit' : 'add'} staff.`} />;
  }
  if (isEdit && staffQuery.isError) {
    return <Result status="404" title="Staff member not found" extra={<Button onClick={() => navigate('/app/human-resource/staff-directory')}>Back to Staff Directory</Button>} />;
  }
  if (isEdit && !existing) {
    return (
      <div style={{ textAlign: 'center', padding: token.paddingXL }}>
        <Spin />
      </div>
    );
  }

  const submit = handleSubmit(
    (values) => saveMutation.mutate(values),
    (invalid) => {
      const first = Object.keys(invalid)[0] as keyof FormValues | undefined;
      if (first) setFocus(first);
      message.error('Please fix the highlighted fields.');
    },
  );
  const fieldError = (name: keyof FormValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message as string } : {};
  const fid = (name: string) => `staff-${name}`;

  const text = (name: TextField, label: string, opts: { required?: boolean; disabled?: boolean; inputMode?: 'tel' | 'decimal' } = {}) => (
    <Controller
      control={control as Control<FormValues>}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={opts.required} {...fieldError(name)}>
          <Input {...field} id={fid(name)} autoComplete="off" disabled={opts.disabled} inputMode={opts.inputMode} />
        </Form.Item>
      )}
    />
  );
  const area = (name: TextField, label: string, rows = 2) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <Input.TextArea {...field} id={fid(name)} rows={rows} />
        </Form.Item>
      )}
    />
  );
  const select = (name: TextField, label: string, options: { value: string; label: string }[], opts: { required?: boolean; loading?: boolean; allowClear?: boolean } = {}) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={opts.required} {...fieldError(name)}>
          <Select
            id={fid(name)}
            placeholder="Select"
            showSearch
            optionFilterProp="label"
            allowClear={opts.allowClear ?? !opts.required}
            loading={opts.loading}
            options={options}
            value={field.value || undefined}
            onChange={(v: string | undefined) => field.onChange(v ?? '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
  const date = (name: 'dateOfBirth' | 'dateOfJoining', label: string, required = false) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} required={required} {...fieldError(name)}>
          <DatePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            allowClear={!required}
            value={field.value ? dayjs(field.value) : null}
            onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
  const leaveInput = (name: LeaveField, label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Form.Item label={label} htmlFor={fid(name)} {...fieldError(name)}>
          <InputNumber
            id={fid(name)}
            style={{ width: '100%' }}
            min={0}
            precision={0}
            placeholder="Number Of Leaves"
            value={field.value}
            onChange={(v) => field.onChange(typeof v === 'number' ? v : null)}
            onBlur={field.onBlur}
          />
        </Form.Item>
      )}
    />
  );
  const col = (node: React.ReactNode, key: string, span: { md?: number; xl?: number } = {}) => (
    <Col key={key} xs={24} md={span.md ?? 12} xl={span.xl ?? 6}>
      {node}
    </Col>
  );

  const roles = (optionsQuery.data?.roles ?? []).map((r) => ({ value: r.id, label: r.name }));
  const designations = (optionsQuery.data?.designations ?? []).map((d) => ({ value: d.id, label: d.name }));
  const departments = (optionsQuery.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name }));
  const lookupLoading = optionsQuery.isLoading;

  const photoShown = !removePhoto && existing?.hasPhoto && !pending.photo;
  const photoPicker = photoShown ? (
    <Space style={{ width: '100%', justifyContent: 'space-between', border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, padding: `${token.paddingXXS}px ${token.paddingXS}px` }}>
      <Space>
        <img src={staffPhotoUrl(existing.id, existing.createdAt)} alt="Current photo" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 2 }} />
        <Text>Current photo</Text>
      </Space>
      <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove photo" onClick={() => setRemovePhoto(true)} />
    </Space>
  ) : (
    <FilePicker
      ariaLabel="Photo"
      accept={IMAGE_TYPES.join(',')}
      value={pending.photo}
      validate={(f) => (!IMAGE_TYPES.includes(f.type) ? 'The photo must be a JPG, PNG or WEBP image' : f.size > MAX_UPLOAD_BYTES ? `${f.name} is larger than 10 MB` : undefined)}
      onRejected={(reason) => message.error(reason)}
      onChange={(file) => setPending((p) => ({ ...p, photo: file }))}
    />
  );

  const documentPicker = (kind: StaffDocumentKind) => {
    const current = existing?.documents.find((d) => d.kind === kind);
    if (current && !removeDocuments.includes(kind) && !pending.documents[kind]) {
      return (
        <Space style={{ width: '100%', justifyContent: 'space-between', border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius, padding: `${token.paddingXXS}px ${token.paddingXS}px` }}>
          <Text ellipsis style={{ maxWidth: 220 }}>
            <PaperClipOutlined /> {current.fileName}
          </Text>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`Remove ${current.title}`} onClick={() => setRemoveDocuments((r) => [...r, kind])} />
        </Space>
      );
    }
    return (
      <FilePicker
        ariaLabel={STAFF_DOCUMENT_KINDS.find((k) => k.kind === kind)?.title ?? kind}
        accept={ALLOWED_UPLOAD_TYPES.join(',')}
        value={pending.documents[kind] ?? null}
        validate={uploadProblem}
        onRejected={(reason) => message.error(reason)}
        onChange={(file) =>
          setPending((p) => {
            const documents = { ...p.documents };
            if (file) documents[kind] = file;
            else delete documents[kind];
            return { ...p, documents };
          })
        }
      />
    );
  };

  const documentRow = (index: number) => {
    const { kind, title } = STAFF_DOCUMENT_KINDS[index];
    return (
      <div key={kind} style={{ display: 'grid', gridTemplateColumns: '28px 150px 1fr', alignItems: 'center', gap: token.marginXS, padding: `${token.paddingXS}px 0`, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <Text>{index + 1}.</Text>
        <Text>{title}</Text>
        {documentPicker(kind)}
      </div>
    );
  };

  return (
    <Form layout="vertical" onFinish={submit} data-testid="staff-form">
      <Card
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="Back to Staff Directory" onClick={() => navigate('/app/human-resource/staff-directory')} />
            <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
              {isEdit ? 'Edit Staff' : 'Basic Information'}
            </Title>
          </Space>
        }
        extra={
          !isEdit &&
          canImport && (
            <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/app/human-resource/staff-directory/import')}>
              Import Staff
            </Button>
          )
        }
        style={{ marginBottom: token.marginLG }}
      >
        {isEdit && (
          <Alert type="info" showIcon style={{ marginBottom: token.marginMD }} message="The Staff ID and the login email can't be changed here." />
        )}
        <Row gutter={token.marginMD}>
          {col(text('staffId', 'Staff ID', { required: true, disabled: isEdit }), 'staffId')}
          {col(select('roleId', 'Role', roles, { required: true, loading: lookupLoading }), 'roleId')}
          {col(select('designationId', 'Designation', designations, { loading: lookupLoading }), 'designationId')}
          {col(select('departmentId', 'Department', departments, { loading: lookupLoading }), 'departmentId')}
          {col(text('firstName', 'First Name', { required: true }), 'firstName')}
          {col(text('lastName', 'Last Name'), 'lastName')}
          {col(text('fatherName', 'Father Name'), 'fatherName')}
          {col(text('motherName', 'Mother Name'), 'motherName')}
          {col(text('email', 'Email (Login Username)', { required: true, disabled: isEdit }), 'email')}
          {col(select('gender', 'Gender', GENDER_OPTIONS, { required: true }), 'gender')}
          {col(date('dateOfBirth', 'Date Of Birth', true), 'dateOfBirth')}
          {col(date('dateOfJoining', 'Date Of Joining'), 'dateOfJoining')}
          {col(text('phone', 'Phone', { inputMode: 'tel' }), 'phone')}
          {col(text('emergencyContactNumber', 'Emergency Contact Number', { inputMode: 'tel' }), 'emergencyContactNumber')}
          {col(select('maritalStatus', 'Marital Status', MARITAL_STATUS_OPTIONS), 'maritalStatus')}
          {col(
            <Form.Item label="Photo">{photoPicker}</Form.Item>,
            'photo',
          )}
          {col(area('currentAddress', 'Address'), 'currentAddress', { md: 24, xl: 12 })}
          {col(area('permanentAddress', 'Permanent Address'), 'permanentAddress', { md: 24, xl: 12 })}
          {col(area('qualification', 'Qualification'), 'qualification', { md: 24, xl: 8 })}
          {col(area('workExperience', 'Work Experience'), 'workExperience', { md: 24, xl: 8 })}
          {col(area('note', 'Note'), 'note', { md: 24, xl: 8 })}
          {col(text('panNumber', 'PAN Number', { required: true }), 'panNumber', { md: 24, xl: 24 })}
        </Row>
      </Card>

      <Card style={{ marginBottom: token.marginLG }} styles={{ body: { padding: 0 } }}>
        <Collapse
          ghost
          defaultActiveKey={['more']}
          items={[
            {
              key: 'more',
              label: (
                <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
                  Add More Details
                </Title>
              ),
              children: (
                <div>
                  {sectionHeader('Payroll', token)}
                  <Row gutter={token.marginMD}>
                    {col(text('epfNo', 'EPF No.'), 'epfNo', { xl: 8 })}
                    {col(text('basicSalary', 'Basic Salary', { inputMode: 'decimal' }), 'basicSalary', { xl: 8 })}
                    {col(select('contractType', 'Contract Type', CONTRACT_TYPE_OPTIONS), 'contractType', { xl: 8 })}
                    {col(text('workShift', 'Work Shift'), 'workShift', { xl: 8 })}
                    {col(text('workLocation', 'Work Location'), 'workLocation', { xl: 8 })}
                  </Row>

                  {sectionHeader('Leaves', token)}
                  <Row gutter={token.marginMD}>
                    {col(leaveInput('medicalLeave', 'Medical Leave'), 'medicalLeave', { xl: 8 })}
                    {col(leaveInput('casualLeave', 'Casual Leave'), 'casualLeave', { xl: 8 })}
                    {col(leaveInput('maternityLeave', 'Maternity Leave'), 'maternityLeave', { xl: 8 })}
                    {col(leaveInput('sickLeave', 'Sick Leave'), 'sickLeave', { xl: 8 })}
                    {col(leaveInput('mandatoryLeave', 'Mandatory Leave'), 'mandatoryLeave', { xl: 8 })}
                  </Row>

                  {sectionHeader('Bank Account Details', token)}
                  <Row gutter={token.marginMD}>
                    {col(text('accountTitle', 'Account Title'), 'accountTitle', { xl: 8 })}
                    {col(text('bankAccountNumber', 'Bank Account Number'), 'bankAccountNumber', { xl: 8 })}
                    {col(text('bankName', 'Bank Name'), 'bankName', { xl: 8 })}
                    {col(text('ifscCode', 'IFSC Code'), 'ifscCode', { xl: 8 })}
                    {col(text('bankBranchName', 'Bank Branch Name'), 'bankBranchName', { xl: 8 })}
                  </Row>

                  {sectionHeader('Social Media Link', token)}
                  <Row gutter={token.marginMD}>
                    {col(text('facebookUrl', 'Facebook URL'), 'facebookUrl', { xl: 12 })}
                    {col(text('twitterUrl', 'Twitter URL'), 'twitterUrl', { xl: 12 })}
                    {col(text('linkedinUrl', 'Linkedin URL'), 'linkedinUrl', { xl: 12 })}
                    {col(text('instagramUrl', 'Instagram URL'), 'instagramUrl', { xl: 12 })}
                  </Row>

                  {sectionHeader('Upload Documents', token)}
                  <Row gutter={token.marginLG}>
                    <Col xs={24} xl={12}>
                      {documentRow(0)}
                      {documentRow(2)}
                    </Col>
                    <Col xs={24} xl={12}>
                      {documentRow(1)}
                      {documentRow(3)}
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
          style={{ padding: `0 ${token.paddingMD}px` }}
        />
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginXS }}>
        <Button onClick={() => navigate('/app/human-resource/staff-directory')}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
          Save
        </Button>
      </div>
    </Form>
  );
}

export default AddStaffPage;
