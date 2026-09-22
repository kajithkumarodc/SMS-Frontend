import type { CSSProperties } from 'react';
import { Controller, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { Alert, DatePicker, Form, Input, Select, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import type { SchoolClass } from '../../../api/classes';
import { BLOOD_GROUPS, GENDER_OPTIONS, type FormValues } from './schema';

const { Text } = Typography;

type Props = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  schoolOptions: { value: string; label: string }[];
  schoolsLoading: boolean;
  classes: SchoolClass[];
  selectedSchoolId: string;
  selectedClassId: string;
  similarName: string | null;
  academicYear: string;
  onAdmissionNumberEdited: () => void;
};

function StudentDetailsStep({
  control,
  errors,
  setValue,
  schoolOptions,
  schoolsLoading,
  classes,
  selectedSchoolId,
  selectedClassId,
  similarName,
  academicYear,
  onAdmissionNumberEdited,
}: Props) {
  const { token } = theme.useToken();

  const classesForSchool = classes.filter((cls) => cls.schoolId === selectedSchoolId);
  const classOptions = classesForSchool.map((cls) => ({ value: cls.id, label: cls.name }));
  const sectionOptions = (classesForSchool.find((cls) => cls.id === selectedClassId)?.sections ?? []).map(
    (section) => ({ value: section.id, label: section.name }),
  );

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    columnGap: token.marginLG,
    rowGap: 0,
  };

  return (
    <div>
      <Controller
        control={control}
        name="schoolId"
        render={({ field }) => (
          <Form.Item
            label="School"
            required
            validateStatus={errors.schoolId ? 'error' : undefined}
            help={errors.schoolId?.message}
          >
            <Select
              {...field}
              data-testid="student-school-select"
              placeholder="Select a school"
              loading={schoolsLoading}
              options={schoolOptions}
              showSearch
              optionFilterProp="label"
              onChange={(value) => {
                field.onChange(value);
                setValue('classId', '');
                setValue('sectionId', '');
              }}
            />
          </Form.Item>
        )}
      />

      <div style={gridStyle}>
        <Controller
          control={control}
          name="firstName"
          render={({ field }) => (
            <Form.Item
              label="First name"
              required
              validateStatus={errors.firstName ? 'error' : undefined}
              help={errors.firstName?.message}
            >
              <Input {...field} data-testid="student-firstname-input" placeholder="e.g. Priya" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="middleName"
          render={({ field }) => (
            <Form.Item
              label="Middle name"
              validateStatus={errors.middleName ? 'error' : undefined}
              help={errors.middleName?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
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
              validateStatus={errors.lastName ? 'error' : undefined}
              help={errors.lastName?.message}
            >
              <Input {...field} data-testid="student-lastname-input" placeholder="e.g. Sharma" autoComplete="off" />
            </Form.Item>
          )}
        />
      </div>

      {!errors.firstName && !errors.lastName && similarName && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: -8, marginBottom: token.marginMD }}
          message={`A student named similarly ("${similarName}") already exists — please confirm this isn't a duplicate.`}
        />
      )}

      <div style={gridStyle}>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Form.Item
              label="Gender"
              required
              validateStatus={errors.gender ? 'error' : undefined}
              help={errors.gender?.message}
            >
              <Select {...field} placeholder="Select gender" options={GENDER_OPTIONS} />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field }) => (
            <Form.Item
              label="Date of birth"
              required
              validateStatus={errors.dateOfBirth ? 'error' : undefined}
              help={errors.dateOfBirth?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : '')}
                disabledDate={(date) => date.isAfter(dayjs(), 'day')}
              />
            </Form.Item>
          )}
        />
      </div>

      <div style={gridStyle}>
        <Controller
          control={control}
          name="admissionNumber"
          render={({ field }) => (
            <Form.Item
              label="Admission number"
              required
              validateStatus={errors.admissionNumber ? 'error' : undefined}
              help={
                errors.admissionNumber?.message ??
                'Auto-suggested; edit it if your school numbers differently.'
              }
            >
              <Input
                {...field}
                data-testid="student-admission-input"
                placeholder="e.g. ADM-2026-001"
                autoComplete="off"
                onChange={(event) => {
                  onAdmissionNumberEdited();
                  field.onChange(event);
                }}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="admissionDate"
          render={({ field }) => (
            <Form.Item
              label="Admission date"
              required
              validateStatus={errors.admissionDate ? 'error' : undefined}
              help={errors.admissionDate?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(date) => field.onChange(date ? date.format('YYYY-MM-DD') : '')}
                disabledDate={(date) => date.isAfter(dayjs(), 'day')}
              />
            </Form.Item>
          )}
        />
      </div>

      <Form.Item label="Academic year">
        <Input value={academicYear} disabled />
      </Form.Item>

      <div style={gridStyle}>
        <Form.Item
          label="Class"
          required
          validateStatus={errors.classId ? 'error' : undefined}
          help={errors.classId?.message}
        >
          <Controller
            control={control}
            name="classId"
            render={({ field }) => (
              <Select
                {...field}
                placeholder={selectedSchoolId ? 'Select a class' : 'Select a school first'}
                disabled={!selectedSchoolId}
                options={classOptions}
                showSearch
                optionFilterProp="label"
                onChange={(value) => {
                  field.onChange(value);
                  setValue('sectionId', '');
                }}
              />
            )}
          />
        </Form.Item>
        <Form.Item
          label="Section"
          required
          validateStatus={errors.sectionId ? 'error' : undefined}
          help={errors.sectionId?.message}
        >
          <Controller
            control={control}
            name="sectionId"
            render={({ field }) => (
              <Select
                {...field}
                placeholder={selectedClassId ? 'Select a section' : 'Select a class first'}
                disabled={!selectedClassId}
                options={sectionOptions}
                showSearch
                optionFilterProp="label"
              />
            )}
          />
        </Form.Item>
      </div>

      <div style={gridStyle}>
        <Controller
          control={control}
          name="rollNumber"
          render={({ field }) => (
            <Form.Item
              label="Roll number"
              validateStatus={errors.rollNumber ? 'error' : undefined}
              help={errors.rollNumber?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="bloodGroup"
          render={({ field }) => (
            <Form.Item
              label="Blood group"
              validateStatus={errors.bloodGroup ? 'error' : undefined}
              help={errors.bloodGroup?.message}
            >
              <Select
                {...field}
                allowClear
                placeholder="Optional"
                options={BLOOD_GROUPS.map((group) => ({ value: group, label: group === 'UNKNOWN' ? 'Unknown' : group }))}
              />
            </Form.Item>
          )}
        />
      </div>

      <div style={gridStyle}>
        <Controller
          control={control}
          name="nationality"
          render={({ field }) => (
            <Form.Item
              label="Nationality"
              validateStatus={errors.nationality ? 'error' : undefined}
              help={errors.nationality?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="e.g. Indian" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="motherTongue"
          render={({ field }) => (
            <Form.Item
              label="Mother tongue"
              validateStatus={errors.motherTongue ? 'error' : undefined}
              help={errors.motherTongue?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
            </Form.Item>
          )}
        />
      </div>

      <Text type="secondary" style={{ fontSize: 12 }}>
        Fields marked * are required.
      </Text>
    </div>
  );
}

export default StudentDetailsStep;
