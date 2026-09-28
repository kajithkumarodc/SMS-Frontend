import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  CarOutlined,
  DownOutlined,
  FileTextOutlined,
  HomeOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
  TagsOutlined,
  TeamOutlined,
  UploadOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  addIdentification,
  createStudent,
  DuplicateAdmissionNumberError,
  fetchAllStudents,
  fetchSchools,
  linkSibling,
  uploadDocument,
  uploadStudentPhoto,
  type CreateStudentInput,
  type Student,
} from '../../../api/students';
import { fetchClasses } from '../../../api/classes';
import { fetchMediums } from '../../../api/mediums';
import { fetchRoutes, assignStudentRoute } from '../../../api/transport';
import { allocateStudentRoom, fetchBlocks, fetchRooms } from '../../../api/hostel';
import { applyDiscountToInvoice, createInvoice, fetchFeeDiscounts, fetchFeeStructures, type FeeStructure } from '../../../api/fees';
import FeeGridTable from '../../fees/FeeGridTable';
import { rowTotal, structureTermTotals, TERM_LABELS, toGrid, type GridRow } from '../../fees/feeGrid';
import { fetchCurrentAcademicYear } from '../../../api/academicYears';
import { useAuthStore } from '../../../store/authStore';
import { hasRole, ROLE } from '../../../lib/roles';
import { API_DATE_FORMAT, DISPLAY_DATE_FORMAT, formatDisplayDate } from '../../../lib/dates';
import { serverMessage } from '../../../lib/apiErrors';
import { uploadProblem } from '../../../lib/files';
import { CLASSES_QUERY_KEY } from '../../classes/queryKeys';
import { defaultSection, namedSections } from '../../classes/sectionLookup';
import { MEDIUMS_QUERY_KEY } from '../../fees/MediumsModal';
import { formatAmount } from '../../fees/format';
import { STUDENTS_QUERY_KEY } from '../queryKeys';
import { suggestAdmissionNumber } from '../AddStudentModal/helpers';
import FilePicker from './FilePicker';
import { admissionSchema, emptyAdmission, MORE_DETAILS_FIELDS, type AdmissionValues } from './schema';

const { Title, Text } = Typography;

const CATEGORY_OPTIONS = ['General', 'OBC', 'BC', 'MBC', 'SC', 'ST', 'EWS'].map((value) => ({ value }));
const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => ({ value, label: value }));
const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];
const RELATION_OPTIONS = [
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other relative' },
];

function defaultAcademicYear(): string {
  const now = dayjs();
  const startYear = now.month() >= 5 ? now.year() : now.year() - 1;
  return `${startYear}-${startYear + 1}`;
}

const photoProblem = (file: File) =>
  ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ? file.size > 10 * 1024 * 1024
      ? `${file.name} is larger than 10 MB`
      : undefined
    : `${file.name}: a photo must be JPG, PNG or WEBP`;

type Files = {
  photo: File | null;
  fatherPhoto: File | null;
  motherPhoto: File | null;
  guardianPhoto: File | null;
  documents: { title: string; file: File | null }[];
};
const emptyFiles = (): Files => ({
  photo: null,
  fatherPhoto: null,
  motherPhoto: null,
  guardianPhoto: null,
  documents: [0, 1, 2, 3].map(() => ({ title: '', file: null })),
});

/**
 * Student Information -> Student Admission, laid out like Smart School: student details, transport, hostel,
 * the fee groups for the chosen class and medium (ticked ones are billed on save), fee discounts, parent/guardian
 * details and a collapsible "Add More Details" panel (addresses, bank, IDs, previous school, documents).
 */
function StudentAdmissionPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canAdmit = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);

  const [files, setFiles] = useState<Files>(emptyFiles);
  const [selectedFees, setSelectedFees] = useState<string[]>([]);
  const [expandedFees, setExpandedFees] = useState<string[]>([]);
  // Per-student changes to a fee group's amounts, made on this page before admitting (recorded on save).
  const [adjustedFees, setAdjustedFees] = useState<Record<string, GridRow[]>>({});
  const [adjustReasons, setAdjustReasons] = useState<Record<string, string>>({});
  const [selectedDiscounts, setSelectedDiscounts] = useState<string[]>([]);
  const [expandedDiscounts, setExpandedDiscounts] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const admissionNumberEdited = useRef(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<AdmissionValues>({ resolver: zodResolver(admissionSchema), defaultValues: emptyAdmission(), mode: 'onTouched' });

  const values = watch();

  const schoolsQuery = useQuery({ queryKey: ['schools'], queryFn: fetchSchools, enabled: canAdmit });
  const classesQuery = useQuery({ queryKey: CLASSES_QUERY_KEY, queryFn: fetchClasses, enabled: canAdmit });
  const mediumsQuery = useQuery({ queryKey: MEDIUMS_QUERY_KEY, queryFn: fetchMediums, enabled: canAdmit });
  const routesQuery = useQuery({ queryKey: ['transport-routes'], queryFn: fetchRoutes, enabled: canAdmit });
  const blocksQuery = useQuery({ queryKey: ['hostel-blocks'], queryFn: fetchBlocks, enabled: canAdmit });
  const roomsQuery = useQuery({
    queryKey: ['hostel-rooms', values.hostelBlockId],
    queryFn: () => fetchRooms(values.hostelBlockId),
    enabled: canAdmit && Boolean(values.hostelBlockId),
  });
  const discountsQuery = useQuery({ queryKey: ['fee-discounts'], queryFn: fetchFeeDiscounts, enabled: canAdmit });
  const yearQuery = useQuery({ queryKey: ['academic-year-current'], queryFn: fetchCurrentAcademicYear, enabled: canAdmit });
  const studentsQuery = useQuery({
    queryKey: [...STUDENTS_QUERY_KEY, 'all-for-admission'],
    queryFn: () => fetchAllStudents({}),
    enabled: canAdmit,
  });
  const academicYear = yearQuery.data?.name ?? (yearQuery.isFetched ? defaultAcademicYear() : undefined);

  const feesQuery = useQuery({
    queryKey: ['fee-structures', 'admission', values.classId, values.mediumId, academicYear],
    queryFn: () =>
      fetchFeeStructures({ classId: values.classId, academicYear, mediumId: values.mediumId || undefined }),
    enabled: canAdmit && Boolean(values.classId) && Boolean(academicYear),
  });
  const feeGroups = useMemo(
    () =>
      (feesQuery.data ?? []).filter(
        (s) => s.status === 'ACTIVE' && (values.mediumId ? true : s.mediumId === null),
      )
        .sort(
          (a, b) =>
            Number(a.classId === null) - Number(b.classId === null) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }),
        ),
    [feesQuery.data, values.mediumId],
  );
  const activeDiscounts = (discountsQuery.data ?? []).filter((d) => d.status === 'ACTIVE');

  // Suggest the next admission number until the user types their own.
  useEffect(() => {
    if (!admissionNumberEdited.current && studentsQuery.data && !getValues('admissionNumber')) {
      setValue('admissionNumber', suggestAdmissionNumber(studentsQuery.data));
    }
  }, [studentsQuery.data, getValues, setValue]);

  // Each fee group's term grid, built once per load so row keys stay stable while adjusting.
  const feeGrids = useMemo(() => Object.fromEntries(feeGroups.map((g) => [g.id, toGrid(g)])), [feeGroups]);
  const gridTotal = (id: string, rows: GridRow[]) => rows.reduce((sum, r) => sum + rowTotal(r, feeGrids[id]?.termCount ?? 1), 0);
  const payableFor = (g: FeeStructure) => (adjustedFees[g.id] ? gridTotal(g.id, adjustedFees[g.id]) : g.amount);

  // Drop fee selections that no longer apply after the class or medium changes.
  useEffect(() => {
    setSelectedFees((ids) => ids.filter((id) => feeGroups.some((g) => g.id === id)));
  }, [feeGroups]);

  // "If Guardian Is" Father/Mother copies that parent's details into the guardian fields.
  const syncGuardian = (who: AdmissionValues['guardianIs']) => {
    const v = getValues();
    if (who === 'FATHER') {
      setValue('guardianName', v.fatherName, { shouldValidate: Boolean(v.fatherName) });
      setValue('guardianPhone', v.fatherPhone, { shouldValidate: Boolean(v.fatherPhone) });
      setValue('guardianOccupation', v.fatherOccupation);
      setValue('guardianRelation', 'FATHER');
    } else if (who === 'MOTHER') {
      setValue('guardianName', v.motherName, { shouldValidate: Boolean(v.motherName) });
      setValue('guardianPhone', v.motherPhone, { shouldValidate: Boolean(v.motherPhone) });
      setValue('guardianOccupation', v.motherOccupation);
      setValue('guardianRelation', 'MOTHER');
    } else {
      setValue('guardianRelation', '');
    }
  };

  if (!canAdmit) {
    return <Result status="403" title="Not available" subTitle="Only a school administrator can admit students." />;
  }

  const selectedClass = classesQuery.data?.find((c) => c.id === values.classId);
  const wholeClass = defaultSection(selectedClass);
  const sectionOptions = namedSections(selectedClass).map((s) => ({ value: s.id, label: s.name }));
  const blankToNull = (v: string) => (v.trim() ? v.trim() : null);

  const onInvalid = (formErrors: Partial<Record<keyof AdmissionValues, unknown>>) => {
    const keys = Object.keys(formErrors) as (keyof AdmissionValues)[];
    if (keys.some((k) => MORE_DETAILS_FIELDS.includes(k))) setMoreOpen(true);
    message.error('Please fix the highlighted fields.');
    const first = keys[0];
    if (first) window.setTimeout(() => setFocus(first as FieldPath<AdmissionValues>), 50);
  };

  const submit = handleSubmit(async (v) => {
    const schoolId = schoolsQuery.data?.[0]?.id;
    if (!schoolId) {
      message.error('Set up the school first.');
      return;
    }
    const current = {
      addressLine1: v.guardianAddressIsCurrent ? blankToNull(v.guardianAddress) : blankToNull(v.addressLine1),
      addressLine2: v.guardianAddressIsCurrent ? null : blankToNull(v.addressLine2),
      city: v.guardianAddressIsCurrent ? null : blankToNull(v.city),
      state: v.guardianAddressIsCurrent ? null : blankToNull(v.state),
      pincode: v.guardianAddressIsCurrent ? null : blankToNull(v.pincode),
    };
    const input: CreateStudentInput = {
      schoolId,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      gender: v.gender as CreateStudentInput['gender'],
      dateOfBirth: v.dateOfBirth,
      bloodGroup: (v.bloodGroup || null) as CreateStudentInput['bloodGroup'],
      religion: blankToNull(v.religion),
      category: blankToNull(v.category),
      admissionNumber: v.admissionNumber.trim(),
      rollNumber: blankToNull(v.rollNumber),
      admissionDate: v.admissionDate || null,
      sectionId: v.sectionId,
      previousSchoolName: blankToNull(v.previousSchool),
      rteStatus: v.rte,
      guardianName: v.guardianName.trim(),
      guardianRelationship: (v.guardianIs === 'OTHER' ? v.guardianRelation : v.guardianIs) as CreateStudentInput['guardianRelationship'],
      guardianPhone: v.guardianPhone.trim(),
      guardianEmail: blankToNull(v.guardianEmail),
      guardianOccupation: blankToNull(v.guardianOccupation),
      fatherName: blankToNull(v.fatherName),
      fatherMobile: blankToNull(v.fatherPhone),
      fatherOccupation: blankToNull(v.fatherOccupation),
      motherName: blankToNull(v.motherName),
      motherMobile: blankToNull(v.motherPhone),
      motherOccupation: blankToNull(v.motherOccupation),
      ...current,
      permanentSameAsCurrentAddress: v.permanentSameAsCurrent,
      permanentAddressLine1: v.permanentSameAsCurrent ? null : blankToNull(v.permanentAddressLine1),
      permanentAddressLine2: v.permanentSameAsCurrent ? null : blankToNull(v.permanentAddressLine2),
      permanentCity: v.permanentSameAsCurrent ? null : blankToNull(v.permanentCity),
      permanentState: v.permanentSameAsCurrent ? null : blankToNull(v.permanentState),
      permanentPincode: v.permanentSameAsCurrent ? null : blankToNull(v.permanentPincode),
      admissionSource: 'WALK_IN',
      extra: {
        mediumId: v.mediumId || null,
        caste: blankToNull(v.caste),
        mobileNumber: blankToNull(v.mobileNumber),
        email: blankToNull(v.email),
        height: blankToNull(v.height),
        weight: blankToNull(v.weight),
        measurementDate: v.measurementDate || null,
        medicalHistory: blankToNull(v.medicalHistory),
        guardianAddress: blankToNull(v.guardianAddress),
        bankAccountNumber: blankToNull(v.bankAccountNumber),
        bankName: blankToNull(v.bankName),
        ifscCode: blankToNull(v.ifscCode),
        note: blankToNull(v.note),
      },
    };

    setSaving(true);
    let student: Student;
    try {
      student = await createStudent(input);
    } catch (error) {
      setSaving(false);
      if (error instanceof DuplicateAdmissionNumberError) {
        setError('admissionNumber', { type: 'server', message: error.message });
        setFocus('admissionNumber');
        return;
      }
      message.error(serverMessage(error) ?? 'Could not admit the student. Please try again.');
      return;
    }

    // Everything else is attached to the new student; a failure here is reported, not fatal.
    const problems: string[] = [];
    const attempt = async (what: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        problems.push(`${what}: ${serverMessage(error) ?? 'failed'}`);
      }
    };
    if (files.photo) await attempt('Student photo', () => uploadStudentPhoto(student.id, files.photo as File));
    if (files.fatherPhoto) await attempt('Father photo', () => uploadDocument(student.id, files.fatherPhoto as File, 'FATHER_PHOTO'));
    if (files.motherPhoto) await attempt('Mother photo', () => uploadDocument(student.id, files.motherPhoto as File, 'MOTHER_PHOTO'));
    if (files.guardianPhoto) await attempt('Guardian photo', () => uploadDocument(student.id, files.guardianPhoto as File, 'GUARDIAN_PHOTO'));
    for (const doc of files.documents) {
      if (doc.file) {
        await attempt(`Document "${doc.title || doc.file.name}"`, () =>
          uploadDocument(student.id, doc.file as File, 'OTHER', doc.title.trim() || undefined),
        );
      }
    }
    if (v.nationalId.trim()) await attempt('National ID', () => addIdentification(student.id, { idType: 'NATIONAL_ID', idValue: v.nationalId.trim() }));
    if (v.localId.trim()) await attempt('Local ID', () => addIdentification(student.id, { idType: 'LOCAL_ID', idValue: v.localId.trim() }));
    if (v.siblingId) await attempt('Sibling link', () => linkSibling(student.id, v.siblingId));
    if (v.routeId) await attempt('Transport route', () => assignStudentRoute(student.id, v.routeId));
    if (v.hostelRoomId) await attempt('Hostel room', () => allocateStudentRoom(student.id, v.hostelRoomId));

    // Bill the ticked fee groups, then apply the ticked discounts: a discount tied to a fee group goes on
    // that group's bill; a general one on the largest bill that has no discount yet.
    const invoices: { structure: FeeStructure; invoiceId: string; discounted: boolean }[] = [];
    for (const id of selectedFees) {
      const structure = feeGroups.find((g) => g.id === id);
      if (!structure) continue;
      await attempt(`Fees "${structure.name}"`, async () => {
        const payable = payableFor(structure);
        const invoice = await createInvoice({
          studentId: student.id,
          feeStructureId: id,
          ...(payable !== structure.amount
            ? { amount: payable, adjustmentReason: adjustReasons[id]?.trim() || 'Adjusted at admission' }
            : {}),
        });
        invoices.push({ structure, invoiceId: invoice.id, discounted: false });
      });
    }
    for (const discountId of selectedDiscounts) {
      const discount = activeDiscounts.find((d) => d.id === discountId);
      if (!discount) continue;
      const target = discount.feeStructureId
        ? invoices.find((i) => i.structure.id === discount.feeStructureId && !i.discounted)
        : [...invoices].filter((i) => !i.discounted).sort((a, b) => b.structure.amount - a.structure.amount)[0];
      if (!target) {
        problems.push(`Discount "${discount.name}": no matching fee group was ticked`);
        continue;
      }
      await attempt(`Discount "${discount.name}"`, async () => {
        await applyDiscountToInvoice(target.invoiceId, discount.id);
        target.discounted = true;
      });
    }

    setSaving(false);
    void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
    admissionNumberEdited.current = false;
    reset(emptyAdmission());
    setFiles(emptyFiles());
    setSelectedFees([]);
    setSelectedDiscounts([]);
    setAdjustedFees({});
    setAdjustReasons({});
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const done = {
      title: `${student.fullName} admitted`,
      content:
        problems.length > 0 ? (
          <>
            <p>The student was saved, but these could not be completed -- add them from the student's profile:</p>
            <ul style={{ paddingLeft: token.paddingLG }}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        ) : (
          `Admission No ${student.admissionNumber}${invoices.length ? `, ${invoices.length} fee group${invoices.length === 1 ? '' : 's'} assigned` : ''}.`
        ),
      okText: 'Admit another',
      cancelText: 'View student',
      onCancel: () => navigate(`/app/student-information/student-details?profile=${student.id}`),
    };
    if (problems.length > 0) modal.warning({ ...done, closable: true });
    else modal.confirm({ ...done, icon: <UserAddOutlined style={{ color: token.colorSuccess }} /> });
  }, onInvalid);

  // --- small field helpers ----------------------------------------------------------------------------------
  const fid = (name: string) => `admission-${name}`;
  const err = (name: keyof AdmissionValues) =>
    errors[name] ? { validateStatus: 'error' as const, help: errors[name]?.message as string } : {};

  const textField = (name: keyof AdmissionValues, label: string, opts: { required?: boolean; placeholder?: string; onEdit?: () => void } = {}) => (
    <Form.Item label={label} htmlFor={fid(name)} required={opts.required} {...err(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Input
            id={fid(name)}
            ref={field.ref}
            value={field.value as string}
            onChange={(e) => {
              opts.onEdit?.();
              field.onChange(e.target.value);
            }}
            onBlur={field.onBlur}
            placeholder={opts.placeholder}
            autoComplete="off"
          />
        )}
      />
    </Form.Item>
  );

  const dateField = (name: keyof AdmissionValues, label: string, required = false, disableFuture = false) => (
    <Form.Item label={label} htmlFor={fid(name)} required={required} {...err(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <DatePicker
            id={fid(name)}
            style={{ width: '100%' }}
            format={DISPLAY_DATE_FORMAT}
            value={field.value ? dayjs(field.value as string) : null}
            onChange={(d) => field.onChange(d ? d.format(API_DATE_FORMAT) : '')}
            onBlur={field.onBlur}
            disabledDate={disableFuture ? (d) => d.isAfter(dayjs(), 'day') : undefined}
          />
        )}
      />
    </Form.Item>
  );

  const selectField = (
    name: keyof AdmissionValues,
    label: string,
    options: { value: string; label: string }[],
    opts: {
      required?: boolean;
      placeholder?: string;
      disabled?: boolean;
      onChange?: (v: string) => void;
      loading?: boolean;
      /** Show the placeholder even though the field holds a value (the hidden whole-class section). */
      hideValue?: boolean;
    } = {},
  ) => (
    <Form.Item label={label} htmlFor={fid(name)} required={opts.required} {...err(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            id={fid(name)}
            ref={field.ref}
            showSearch
            allowClear={!opts.required}
            optionFilterProp="label"
            placeholder={opts.placeholder ?? 'Select'}
            disabled={opts.disabled}
            loading={opts.loading}
            options={options}
            value={opts.hideValue ? undefined : (field.value as string) || undefined}
            onChange={(v) => {
              field.onChange(v ?? '');
              opts.onChange?.(v ?? '');
            }}
            onBlur={field.onBlur}
          />
        )}
      />
    </Form.Item>
  );

  const textArea = (name: keyof AdmissionValues, label: string, rows = 2) => (
    <Form.Item label={label} htmlFor={fid(name)} {...err(name)}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => <Input.TextArea id={fid(name)} rows={rows} {...field} value={field.value as string} />}
      />
    </Form.Item>
  );

  const photoField = (key: 'photo' | 'fatherPhoto' | 'motherPhoto' | 'guardianPhoto', label: string) => (
    <Form.Item label={`${label} (100px X 100px)`}>
      <FilePicker
        ariaLabel={label}
        accept="image/jpeg,image/png,image/webp"
        value={files[key]}
        validate={photoProblem}
        onRejected={(reason) => message.error(reason)}
        onChange={(file) => setFiles((f) => ({ ...f, [key]: file }))}
      />
    </Form.Item>
  );

  const sectionHeader = (icon: React.ReactNode, title: string, extra?: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        background: token.colorFillQuaternary,
        margin: `${token.marginLG}px -${token.paddingLG}px ${token.marginMD}px`,
        padding: `${token.paddingSM}px ${token.paddingLG}px`,
        borderBlock: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Title level={5} style={{ margin: 0, fontWeight: 500 }}>
        <Space size={token.marginXS}>
          {icon}
          {title}
        </Space>
      </Title>
      {extra}
    </div>
  );

  const col = { xs: 24, sm: 12, lg: 6 };
  const col3 = { xs: 24, md: 8 };

  const selectableRow = (
    key: string,
    checked: boolean,
    onCheck: (checked: boolean) => void,
    open: boolean,
    onToggle: () => void,
    title: React.ReactNode,
    amount: React.ReactNode,
    body: React.ReactNode,
  ) => (
    <div
      key={key}
      style={{
        border: `1px solid ${checked ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
        background: checked ? token.colorPrimaryBg : undefined,
        borderRadius: token.borderRadius,
        marginBottom: token.marginXS,
        transition: 'background 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM, padding: `${token.paddingXS}px ${token.paddingSM}px` }}>
        <Button
          type="text"
          size="small"
          icon={open ? <MinusOutlined /> : <PlusOutlined />}
          aria-label={open ? 'Hide details' : 'Show details'}
          aria-expanded={open}
          onClick={onToggle}
        />
        <Checkbox checked={checked} onChange={(e) => onCheck(e.target.checked)} style={{ flex: 1 }}>
          {title}
        </Checkbox>
        <Button type="link" onClick={onToggle} aria-label="Show fee breakdown" style={{ paddingInline: 0, fontWeight: 600 }}>
          {amount}
        </Button>
      </div>
      {open && <div style={{ padding: `0 ${token.paddingSM}px ${token.paddingSM}px` }}>{body}</div>}
    </div>
  );

  const selectedTotal = feeGroups.filter((g) => selectedFees.includes(g.id)).reduce((sum, g) => sum + payableFor(g), 0);

  return (
    <Form layout="vertical" onFinish={() => void submit()} requiredMark>
      <Card
        title={
          <Title level={4} style={{ margin: 0, fontWeight: 500 }}>
            Student Admission
          </Title>
        }
        extra={
          <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/app/student-information/student-admission/import')}>
            Import Student
          </Button>
        }
        styles={{ body: { paddingBottom: token.paddingLG } }}
      >
        <Row gutter={token.marginLG}>
          <Col {...col}>{textField('admissionNumber', 'Admission No', { required: true, onEdit: () => (admissionNumberEdited.current = true) })}</Col>
          <Col {...col}>{textField('rollNumber', 'Roll Number')}</Col>
          <Col {...col}>
            {selectField(
              'classId',
              'Class',
              (classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
              {
                required: true,
                loading: classesQuery.isLoading,
                onChange: (v) => {
                  const whole = defaultSection(classesQuery.data?.find((c) => c.id === v));
                  setValue('sectionId', whole?.id ?? '', { shouldValidate: Boolean(whole) });
                },
              },
            )}
          </Col>
          <Col {...col}>
            {selectField('sectionId', 'Section', sectionOptions, {
              required: !wholeClass,
              disabled: !values.classId || Boolean(wholeClass),
              hideValue: Boolean(wholeClass),
              placeholder: !values.classId ? 'Select a class first' : wholeClass ? 'Whole class (no sections)' : 'Select',
            })}
          </Col>
          <Col {...col}>{textField('firstName', 'First Name', { required: true })}</Col>
          <Col {...col}>{textField('lastName', 'Last Name')}</Col>
          <Col {...col}>{selectField('gender', 'Gender', GENDER_OPTIONS, { required: true })}</Col>
          <Col {...col}>{dateField('dateOfBirth', 'Date Of Birth', true, true)}</Col>
          <Col {...col}>
            <Form.Item label="Category" htmlFor={fid('category')} {...err('category')}>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <AutoComplete id={fid('category')} options={CATEGORY_OPTIONS} placeholder="Select or type" {...field} filterOption />
                )}
              />
            </Form.Item>
          </Col>
          <Col {...col}>{textField('religion', 'Religion')}</Col>
          <Col {...col}>{textField('caste', 'Caste')}</Col>
          <Col {...col}>
            {selectField(
              'mediumId',
              'Medium',
              (mediumsQuery.data ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name })),
              { loading: mediumsQuery.isLoading, placeholder: 'Select (decides the fees)' },
            )}
          </Col>
          <Col {...col}>{textField('mobileNumber', 'Mobile Number')}</Col>
          <Col {...col}>{textField('email', 'Email')}</Col>
          <Col {...col}>{dateField('admissionDate', 'Admission Date')}</Col>
          <Col {...col}>{selectField('bloodGroup', 'Blood Group', BLOOD_GROUP_OPTIONS)}</Col>
          <Col {...col}>{photoField('photo', 'Student Photo')}</Col>
          <Col {...col}>{textField('height', 'Height', { placeholder: "e.g. 4'2 or 128 cm" })}</Col>
          <Col {...col}>{textField('weight', 'Weight', { placeholder: 'e.g. 34 kg' })}</Col>
          <Col {...col}>{dateField('measurementDate', 'Measurement Date')}</Col>
          <Col {...col}>
            {selectField(
              'siblingId',
              'Sibling (if any)',
              (studentsQuery.data ?? []).map((s) => ({ value: s.id, label: `${s.fullName} (${s.admissionNumber})` })),
              { loading: studentsQuery.isLoading, placeholder: 'Search a brother or sister' },
            )}
          </Col>
          <Col xs={24}>{textArea('medicalHistory', 'Medical History')}</Col>
        </Row>

        {sectionHeader(<CarOutlined />, 'Transport Details')}
        <Row gutter={token.marginLG}>
          <Col {...col3}>
            {selectField(
              'routeId',
              'Route List',
              (routesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
              { loading: routesQuery.isLoading, placeholder: routesQuery.data?.length === 0 ? 'No routes set up' : 'Select' },
            )}
          </Col>
        </Row>

        {sectionHeader(<HomeOutlined />, 'Hostel Details')}
        <Row gutter={token.marginLG}>
          <Col xs={24} md={12}>
            {selectField(
              'hostelBlockId',
              'Hostel',
              (blocksQuery.data ?? []).map((b) => ({ value: b.id, label: b.name })),
              {
                loading: blocksQuery.isLoading,
                placeholder: blocksQuery.data?.length === 0 ? 'No hostels set up' : 'Select',
                onChange: () => setValue('hostelRoomId', ''),
              },
            )}
          </Col>
          <Col xs={24} md={12}>
            {selectField(
              'hostelRoomId',
              'Room No.',
              (roomsQuery.data ?? []).map((r) => ({
                value: r.id,
                label: `${r.roomNumber} (${r.occupied}/${r.capacity} filled)`,
                disabled: r.occupied >= r.capacity,
              })),
              { disabled: !values.hostelBlockId, loading: roomsQuery.isLoading, placeholder: values.hostelBlockId ? 'Select' : 'Select a hostel first' },
            )}
          </Col>
        </Row>

        {sectionHeader(
          <WalletOutlined />,
          'Fees Details',
          selectedFees.length > 0 && (
            <Text strong>
              Selected: {selectedFees.length} · {formatAmount(selectedTotal)}
            </Text>
          ),
        )}
        {!values.classId ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a class (and medium) to see its fees" />
        ) : feesQuery.isLoading ? (
          <Text type="secondary">Loading fees...</Text>
        ) : feeGroups.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`No fees set for ${selectedClass?.name ?? 'this class'}${values.mediumId ? ' in this medium' : ''} (${academicYear}).`}
          >
            <Button onClick={() => navigate('/app/fees-collection/fees-master')}>Set up fees in Fees Master</Button>
          </Empty>
        ) : (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXS }}>
              Tick the fee groups to bill this student for. Click a total to see the full fee breakdown; a ticked group&apos;s
              amounts can be adjusted for this student. Session {academicYear}
              {values.mediumId ? '' : ' -- pick a Medium to also see medium-specific fees'}.
            </Text>
            {feeGroups.map((g) => {
              const grid = feeGrids[g.id];
              const checked = selectedFees.includes(g.id);
              const rows = adjustedFees[g.id] ?? grid.rows;
              const payable = payableFor(g);
              const changed = payable !== g.amount;
              const terms = structureTermTotals(g);
              return selectableRow(
                g.id,
                checked,
                (isChecked) => setSelectedFees((ids) => (isChecked ? [...ids, g.id] : ids.filter((id) => id !== g.id))),
                expandedFees.includes(g.id),
                () => setExpandedFees((ids) => (ids.includes(g.id) ? ids.filter((id) => id !== g.id) : [...ids, g.id])),
                <Space size={token.marginXS} wrap>
                  {g.name}
                  {g.mediumId === null && <Tag>All mediums</Tag>}
                  {!g.classId && <Tag color="blue">All classes</Tag>}
                  {terms.length > 1 && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {terms.map((t, i) => `${TERM_LABELS[i]} ${formatAmount(t)}`).join(' · ')}
                    </Text>
                  )}
                </Space>,
                changed ? (
                  <Space size={token.marginXXS}>
                    <Text delete type="secondary">{formatAmount(g.amount)}</Text>
                    {formatAmount(payable)}
                  </Space>
                ) : (
                  formatAmount(g.amount)
                ),
                <>
                  <FeeGridTable
                    mode={checked ? 'amounts' : 'view'}
                    rows={rows}
                    original={grid.rows}
                    termCount={grid.termCount}
                    termDates={grid.termDates}
                    onRowsChange={(next) => setAdjustedFees((a) => ({ ...a, [g.id]: next }))}
                  />
                  {checked && changed && (
                    <Space wrap style={{ marginTop: token.marginXS }}>
                      <Tag color="warning">Adjusted for this student: {formatAmount(payable - g.amount)}</Tag>
                      <Input
                        aria-label={`Reason for adjusting ${g.name}`}
                        placeholder="Reason (e.g. staff child, uniform not needed)"
                        style={{ width: 340 }}
                        maxLength={500}
                        value={adjustReasons[g.id] ?? ''}
                        onChange={(e) => setAdjustReasons((r) => ({ ...r, [g.id]: e.target.value }))}
                      />
                      <Button
                        size="small"
                        onClick={() =>
                          setAdjustedFees((a) => {
                            const next = { ...a };
                            delete next[g.id];
                            return next;
                          })
                        }
                      >
                        Reset to template
                      </Button>
                    </Space>
                  )}
                  {!checked && (
                    <Text type="secondary" style={{ display: 'block', marginTop: token.marginXXS, fontSize: token.fontSizeSM }}>
                      Tick this fee group to adjust its amounts for this student.
                    </Text>
                  )}
                </>,
              );
            })}
          </>
        )}

        {sectionHeader(<TagsOutlined />, 'Fees Discount Details')}
        {activeDiscounts.length === 0 ? (
          <Text type="secondary">No fee discounts set up.</Text>
        ) : (
          activeDiscounts.map((d) =>
            selectableRow(
              d.id,
              selectedDiscounts.includes(d.id),
              (checked) => setSelectedDiscounts((ids) => (checked ? [...ids, d.id] : ids.filter((id) => id !== d.id))),
              expandedDiscounts.includes(d.id),
              () => setExpandedDiscounts((ids) => (ids.includes(d.id) ? ids.filter((id) => id !== d.id) : [...ids, d.id])),
              d.name,
              d.discountType === 'PERCENTAGE' ? `${d.value}%` : formatAmount(d.value),
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={[d]}
                columns={[
                  { key: 'n', title: 'Name', dataIndex: 'name' },
                  { key: 't', title: 'Type', render: () => (d.discountType === 'PERCENTAGE' ? 'Percentage' : 'Fix') },
                  {
                    key: 'f',
                    title: 'Applies to',
                    render: () => (d.feeStructureId ? feesQuery.data?.find((g) => g.id === d.feeStructureId)?.name ?? 'One fee group' : 'Any fee group'),
                  },
                  { key: 'a', title: 'Amount', align: 'right', render: () => (d.discountType === 'PERCENTAGE' ? `${d.value}%` : formatAmount(d.value)) },
                ]}
              />,
            ),
          )
        )}

        {sectionHeader(<TeamOutlined />, 'Parent Guardian Detail')}
        <Row gutter={token.marginLG}>
          <Col {...col}>{textField('fatherName', 'Father Name')}</Col>
          <Col {...col}>{textField('fatherPhone', 'Father Phone')}</Col>
          <Col {...col}>{textField('fatherOccupation', 'Father Occupation')}</Col>
          <Col {...col}>{photoField('fatherPhoto', 'Father Photo')}</Col>
          <Col {...col}>{textField('motherName', 'Mother Name')}</Col>
          <Col {...col}>{textField('motherPhone', 'Mother Phone')}</Col>
          <Col {...col}>{textField('motherOccupation', 'Mother Occupation')}</Col>
          <Col {...col}>{photoField('motherPhoto', 'Mother Photo')}</Col>
          <Col xs={24}>
            <Form.Item label="If Guardian Is" required {...err('guardianIs')}>
              <Controller
                control={control}
                name="guardianIs"
                render={({ field }) => (
                  <Radio.Group
                    value={field.value}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      syncGuardian(e.target.value);
                    }}
                    options={[
                      { value: 'FATHER', label: 'Father' },
                      { value: 'MOTHER', label: 'Mother' },
                      { value: 'OTHER', label: 'Other' },
                    ]}
                  />
                )}
              />
            </Form.Item>
          </Col>
          <Col {...col}>{textField('guardianName', 'Guardian Name', { required: true })}</Col>
          <Col {...col}>
            {values.guardianIs === 'OTHER' ? (
              selectField('guardianRelation', 'Guardian Relation', RELATION_OPTIONS, { required: true })
            ) : (
              <Form.Item label="Guardian Relation" htmlFor={fid('guardianRelationShown')}>
                <Input
                  id={fid('guardianRelationShown')}
                  disabled
                  value={values.guardianIs === 'FATHER' ? 'Father' : values.guardianIs === 'MOTHER' ? 'Mother' : ''}
                  placeholder="Choose If Guardian Is"
                />
              </Form.Item>
            )}
          </Col>
          <Col {...col}>{textField('guardianEmail', 'Guardian Email')}</Col>
          <Col {...col}>{photoField('guardianPhoto', 'Guardian Photo')}</Col>
          <Col {...col}>{textField('guardianPhone', 'Guardian Phone', { required: true })}</Col>
          <Col {...col}>{textField('guardianOccupation', 'Guardian Occupation')}</Col>
          <Col xs={24} lg={12}>{textArea('guardianAddress', 'Guardian Address')}</Col>
        </Row>

        <div
          role="button"
          tabIndex={0}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setMoreOpen((o) => !o))}
          style={{ cursor: 'pointer' }}
        >
          {sectionHeader(<FileTextOutlined />, 'Add More Details', moreOpen ? <DownOutlined /> : <RightOutlined />)}
        </div>
        {moreOpen && (
          <div>
            <Title level={5} style={{ fontWeight: 500 }}>
              Student Address Details
            </Title>
            <Row gutter={token.marginLG}>
              <Col xs={24} lg={12}>
                <Controller
                  control={control}
                  name="guardianAddressIsCurrent"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} style={{ marginBottom: token.marginSM }}>
                      If Guardian Address Is Current Address
                    </Checkbox>
                  )}
                />
                {values.guardianAddressIsCurrent ? (
                  <Alert type="info" showIcon message="The guardian address will be saved as the current address." style={{ marginBottom: token.marginMD }} />
                ) : (
                  <Row gutter={token.marginSM}>
                    <Col xs={24}>{textField('addressLine1', 'Current Address')}</Col>
                    <Col xs={24}>{textField('addressLine2', 'Address Line 2')}</Col>
                    <Col xs={24} sm={8}>{textField('city', 'City')}</Col>
                    <Col xs={24} sm={8}>{textField('state', 'State')}</Col>
                    <Col xs={24} sm={8}>{textField('pincode', 'PIN Code')}</Col>
                  </Row>
                )}
              </Col>
              <Col xs={24} lg={12}>
                <Controller
                  control={control}
                  name="permanentSameAsCurrent"
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} style={{ marginBottom: token.marginSM }}>
                      If Permanent Address Is Current Address
                    </Checkbox>
                  )}
                />
                {values.permanentSameAsCurrent ? (
                  <Alert type="info" showIcon message="The current address will be saved as the permanent address too." style={{ marginBottom: token.marginMD }} />
                ) : (
                  <Row gutter={token.marginSM}>
                    <Col xs={24}>{textField('permanentAddressLine1', 'Permanent Address')}</Col>
                    <Col xs={24}>{textField('permanentAddressLine2', 'Address Line 2')}</Col>
                    <Col xs={24} sm={8}>{textField('permanentCity', 'City')}</Col>
                    <Col xs={24} sm={8}>{textField('permanentState', 'State')}</Col>
                    <Col xs={24} sm={8}>{textField('permanentPincode', 'PIN Code')}</Col>
                  </Row>
                )}
              </Col>
            </Row>

            <Title level={5} style={{ fontWeight: 500, marginTop: token.marginMD }}>
              Miscellaneous Details
            </Title>
            <Row gutter={token.marginLG}>
              <Col {...col3}>{textField('bankAccountNumber', 'Bank Account Number')}</Col>
              <Col {...col3}>{textField('bankName', 'Bank Name')}</Col>
              <Col {...col3}>{textField('ifscCode', 'IFSC Code')}</Col>
              <Col {...col3}>{textField('nationalId', 'National Identification Number', { placeholder: 'e.g. Aadhaar number' })}</Col>
              <Col {...col3}>{textField('localId', 'Local Identification Number')}</Col>
              <Col {...col3}>
                <Form.Item label="RTE">
                  <Controller
                    control={control}
                    name="rte"
                    render={({ field }) => (
                      <Radio.Group
                        value={field.value ? 'yes' : 'no'}
                        onChange={(e) => field.onChange(e.target.value === 'yes')}
                        options={[
                          { value: 'yes', label: 'Yes' },
                          { value: 'no', label: 'No' },
                        ]}
                      />
                    )}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>{textArea('previousSchool', 'Previous School Details', 3)}</Col>
              <Col xs={24} lg={12}>{textArea('note', 'Note', 3)}</Col>
            </Row>

            <Title level={5} style={{ fontWeight: 500, marginTop: token.marginMD }}>
              Upload Documents
            </Title>
            <Row gutter={[token.marginLG, token.marginSM]}>
              {files.documents.map((doc, i) => (
                <Col xs={24} lg={12} key={i}>
                  <Row gutter={token.marginSM} align="middle" wrap={false}>
                    <Col flex="none">
                      <Text>{i + 1}.</Text>
                    </Col>
                    <Col flex="1 1 40%">
                      <Input
                        aria-label={`Document ${i + 1} title`}
                        placeholder="Title, e.g. Birth Certificate"
                        value={doc.title}
                        maxLength={200}
                        onChange={(e) =>
                          setFiles((f) => ({ ...f, documents: f.documents.map((d, j) => (j === i ? { ...d, title: e.target.value } : d)) }))
                        }
                      />
                    </Col>
                    <Col flex="1 1 60%">
                      <FilePicker
                        ariaLabel={`Document ${i + 1} file`}
                        value={doc.file}
                        validate={uploadProblem}
                        onRejected={(reason) => message.error(reason)}
                        onChange={(file) =>
                          setFiles((f) => ({ ...f, documents: f.documents.map((d, j) => (j === i ? { ...d, file } : d)) }))
                        }
                      />
                    </Col>
                  </Row>
                </Col>
              ))}
            </Row>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: token.marginSM, marginTop: token.marginXL }}>
          <Button
            onClick={() => {
              admissionNumberEdited.current = false;
              reset({ ...emptyAdmission(), admissionNumber: studentsQuery.data ? suggestAdmissionNumber(studentsQuery.data) : '' });
              setFiles(emptyFiles());
              setSelectedFees([]);
              setSelectedDiscounts([]);
            }}
            disabled={saving}
          >
            Reset
          </Button>
          <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />} loading={saving}>
            Save
          </Button>
        </div>
      </Card>
    </Form>
  );
}

export default StudentAdmissionPage;
