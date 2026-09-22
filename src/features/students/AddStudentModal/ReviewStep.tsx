import { Button, Descriptions, Space, Tag, Typography, theme } from 'antd';
import dayjs from 'dayjs';
import {
  LANGUAGE_OPTIONS,
  RELATIONSHIP_LABEL,
  type FormValues,
} from './schema';
import { combineFullName } from './helpers';

const { Text } = Typography;

type Props = {
  values: FormValues;
  schoolName: string | undefined;
  className: string | undefined;
  sectionName: string | undefined;
  academicYear: string;
  onEditStep: (step: number) => void;
};

function formatDate(value: string | undefined): string {
  return value ? dayjs(value).format('D MMM YYYY') : '—';
}

function SectionHeading({ title, onEdit }: { title: string; onEdit: () => void }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: token.marginXS,
      }}
    >
      <Text strong>{title}</Text>
      <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

function ReviewStep({ values, schoolName, className, sectionName, academicYear, onEditStep }: Props) {
  const { token } = theme.useToken();
  const languageLabel = LANGUAGE_OPTIONS.find((option) => option.value === values.preferredLanguage)?.label;

  const fatherLine = [values.fatherName, values.fatherMobile].filter(Boolean).join(' · ');
  const motherLine = [values.motherName, values.motherMobile].filter(Boolean).join(' · ');
  const emergencyLine = [
    values.emergencyContactName,
    values.emergencyContactRelationship ? RELATIONSHIP_LABEL[values.emergencyContactRelationship] : null,
    values.emergencyContactMobile,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Space direction="vertical" size={token.marginMD} style={{ width: '100%' }}>
      <div>
        <SectionHeading title="Student details" onEdit={() => onEditStep(0)} />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="School">{schoolName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Full name">
            {combineFullName(values.firstName, values.middleName, values.lastName) || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Gender">{values.gender ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Date of birth">{formatDate(values.dateOfBirth)}</Descriptions.Item>
          <Descriptions.Item label="Admission number">{values.admissionNumber || '—'}</Descriptions.Item>
          <Descriptions.Item label="Admission date">{formatDate(values.admissionDate)}</Descriptions.Item>
          <Descriptions.Item label="Academic year">{academicYear}</Descriptions.Item>
          <Descriptions.Item label="Class">{className || '—'}</Descriptions.Item>
          <Descriptions.Item label="Section">{sectionName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Roll number">{values.rollNumber || '—'}</Descriptions.Item>
          <Descriptions.Item label="Blood group">
            {values.bloodGroup ? (values.bloodGroup === 'UNKNOWN' ? 'Unknown' : values.bloodGroup) : '—'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div>
        <SectionHeading title="Parent / guardian" onEdit={() => onEditStep(1)} />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Primary guardian">{values.guardianName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Relationship">
            {values.guardianRelationship ? RELATIONSHIP_LABEL[values.guardianRelationship] : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Mobile">{values.guardianPhone || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{values.guardianEmail || '—'}</Descriptions.Item>
          <Descriptions.Item label="Father">{fatherLine || '—'}</Descriptions.Item>
          <Descriptions.Item label="Mother">{motherLine || '—'}</Descriptions.Item>
          <Descriptions.Item label="Emergency contact">{emergencyLine || '—'}</Descriptions.Item>
        </Descriptions>
      </div>

      <div>
        <SectionHeading title="Address" onEdit={() => onEditStep(2)} />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Complete address">
            {[values.addressLine1, values.addressLine2, values.city, values.state, values.pincode]
              .filter(Boolean)
              .join(', ') || '—'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div>
        <SectionHeading title="Communication" onEdit={() => onEditStep(2)} />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="SMS notifications">
            {values.smsNotificationsEnabled ? 'On' : 'Off'}
          </Descriptions.Item>
          <Descriptions.Item label="WhatsApp notifications">
            {values.whatsappNotificationsEnabled ? 'On' : 'Off'}
          </Descriptions.Item>
          <Descriptions.Item label="Email notifications">
            {values.emailNotificationsEnabled ? 'On' : 'Off'}
          </Descriptions.Item>
          <Descriptions.Item label="Preferred language">{languageLabel ?? '—'}</Descriptions.Item>
        </Descriptions>
      </div>

      <div>
        <Text strong style={{ marginInlineEnd: token.marginXS }}>
          Status:
        </Text>
        <Tag color="success" style={{ marginInlineEnd: 0 }}>
          ACTIVE
        </Tag>
      </div>
    </Space>
  );
}

export default ReviewStep;
