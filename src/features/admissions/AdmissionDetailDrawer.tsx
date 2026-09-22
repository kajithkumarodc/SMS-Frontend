import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Input,
  List,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import {
  applicationDocumentDownloadUrl,
  approveApplication,
  fetchAdmissionApplication,
  fetchApplicationDocuments,
  rejectApplication,
  reopenApplication,
  startReviewApplication,
  uploadApplicationDocument,
  waitlistApplication,
  type AdmissionApplicationStatus,
} from '../../api/admissions';
import { ADMISSION_APPLICATIONS_KEY, ADMISSION_APPLICATION_DOCUMENTS_KEY, ADMISSION_APPLICATION_KEY } from './queryKeys';

const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

const STATUS_COLOR: Record<AdmissionApplicationStatus, string> = {
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'gold',
  WAITLISTED: 'purple',
  APPROVED: 'green',
  REJECTED: 'red',
};

const DOCUMENT_TYPES = ['BIRTH_CERTIFICATE', 'PREVIOUS_SCHOOL_REPORT', 'TRANSFER_CERTIFICATE', 'STUDENT_PHOTO', 'IDENTITY_DOCUMENT', 'OTHER'];

type Props = {
  applicationId: string | null;
  onClose: () => void;
  permissions: {
    canReview: boolean;
    canApprove: boolean;
    canReject: boolean;
    canWaitlist: boolean;
    canEditDocuments: boolean;
  };
};

function AdmissionDetailDrawer({ applicationId, onClose, permissions }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');
  const [documentType, setDocumentType] = useState<string>('OTHER');

  const open = applicationId !== null;

  const detailQuery = useQuery({
    queryKey: [...ADMISSION_APPLICATION_KEY, applicationId],
    queryFn: () => fetchAdmissionApplication(applicationId as string),
    enabled: open,
  });
  const documentsQuery = useQuery({
    queryKey: [...ADMISSION_APPLICATION_DOCUMENTS_KEY, applicationId],
    queryFn: () => fetchApplicationDocuments(applicationId as string),
    enabled: open,
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ADMISSION_APPLICATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: [...ADMISSION_APPLICATION_KEY, applicationId] });
  };

  const startReviewMutation = useMutation({
    mutationFn: () => startReviewApplication(applicationId as string),
    onSuccess: invalidateAll,
    onError: () => message.error('Could not move this application into review.'),
  });
  const approveMutation = useMutation({
    mutationFn: () => approveApplication(applicationId as string, notes || undefined),
    onSuccess: (result) => {
      message.success(
        `Approved -- student admission number ${result.studentAdmissionNumber}` +
          (result.portalInvitationSent ? '. A portal invitation email was sent.' : '.'),
      );
      setNotes('');
      invalidateAll();
    },
    onError: () => message.error('Could not approve this application.'),
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectApplication(applicationId as string, notes),
    onSuccess: () => {
      message.success('Application rejected');
      setNotes('');
      invalidateAll();
    },
    onError: () => message.error('Could not reject this application.'),
  });
  const waitlistMutation = useMutation({
    mutationFn: () => waitlistApplication(applicationId as string, notes || undefined),
    onSuccess: () => {
      message.success('Application waitlisted');
      setNotes('');
      invalidateAll();
    },
    onError: () => message.error('Could not waitlist this application.'),
  });
  const reopenMutation = useMutation({
    mutationFn: () => reopenApplication(applicationId as string, notes || undefined),
    onSuccess: () => {
      message.success('Application reopened for review');
      setNotes('');
      invalidateAll();
    },
    onError: () => message.error('Could not reopen this application.'),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadApplicationDocument(applicationId as string, documentType, file),
    onSuccess: () => {
      message.success('Document uploaded');
      void queryClient.invalidateQueries({ queryKey: [...ADMISSION_APPLICATION_DOCUMENTS_KEY, applicationId] });
    },
    onError: () => message.error('Could not upload this file (check type and 10 MB size limit).'),
  });

  const application = detailQuery.data;
  const status = application?.status;
  const busy =
    startReviewMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    waitlistMutation.isPending ||
    reopenMutation.isPending;

  return (
    <Drawer title="Application review" width={640} open={open} onClose={onClose} destroyOnHidden>
      {detailQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : !application ? (
        <Paragraph type="secondary">Could not load this application.</Paragraph>
      ) : (
        <>
          <Space align="center" style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>
              {application.applicationNumber}
            </Title>
            {status && <Tag color={STATUS_COLOR[status]}>{status}</Tag>}
          </Space>

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Applicant" span={2}>
              {[application.firstName, application.middleName, application.lastName].filter(Boolean).join(' ')}
            </Descriptions.Item>
            <Descriptions.Item label="Date of birth">{application.dateOfBirth}</Descriptions.Item>
            <Descriptions.Item label="Gender">{application.gender ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Applying for class">{application.applyingClassName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Admission cycle">{application.admissionCycleName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Guardian" span={2}>
              {application.guardianName ?? '—'} ({application.guardianRelationship ?? '—'})
            </Descriptions.Item>
            <Descriptions.Item label="Guardian phone">{application.guardianPhone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Guardian email">{application.guardianEmail ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Previous school" span={2}>
              {application.previousSchoolName ?? '—'}
              {application.previousSchoolClass ? ` (${application.previousSchoolClass})` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {[application.addressLine1, application.city, application.state, application.country, application.pincode]
                .filter(Boolean)
                .join(', ') || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Submitted">{new Date(application.submittedAt).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Reviewed by">{application.reviewedByName ?? '—'}</Descriptions.Item>
            {application.reviewerNotes && (
              <Descriptions.Item label="Reviewer notes" span={2}>
                {application.reviewerNotes}
              </Descriptions.Item>
            )}
            {application.convertedStudentId && (
              <Descriptions.Item label="Converted" span={2}>
                Student created (admission number on the Students page).
              </Descriptions.Item>
            )}
          </Descriptions>

          <Divider>Documents</Divider>
          {documentsQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <List
              size="small"
              dataSource={documentsQuery.data ?? []}
              locale={{ emptyText: 'No documents uploaded' }}
              renderItem={(doc) => (
                <List.Item
                  actions={[
                    <a
                      key="download"
                      href={applicationDocumentDownloadUrl(application.id, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <DownloadOutlined /> Download
                    </a>,
                  ]}
                >
                  <Text>{doc.documentType}</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {doc.originalFilename}
                  </Text>
                </List.Item>
              )}
            />
          )}

          {permissions.canEditDocuments && (
            <div style={{ marginTop: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select value={documentType} onChange={setDocumentType} style={{ width: 260 }} options={DOCUMENT_TYPES.map((t) => ({ value: t, label: t }))} />
                <Dragger
                  multiple={false}
                  showUploadList={false}
                  disabled={uploadMutation.isPending}
                  customRequest={({ file, onSuccess, onError }) => {
                    uploadMutation.mutate(file as File, {
                      onSuccess: () => onSuccess?.({}),
                      onError: (err) => onError?.(err as Error),
                    });
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Click or drag a file to upload (PDF, JPG, PNG, WEBP, DOC, DOCX, max 10MB)</p>
                </Dragger>
              </Space>
            </div>
          )}

          {status && status !== 'APPROVED' && (permissions.canReview || permissions.canApprove || permissions.canReject || permissions.canWaitlist) && (
            <>
              <Divider>Review actions</Divider>
              <Input.TextArea
                data-testid="admission-review-notes-input"
                rows={2}
                placeholder="Notes (optional for waitlist/reopen, required for reject)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <Space wrap>
                {status === 'SUBMITTED' && permissions.canReview && (
                  <Button onClick={() => startReviewMutation.mutate()} loading={startReviewMutation.isPending}>
                    Start review
                  </Button>
                )}
                {(status === 'WAITLISTED' || status === 'REJECTED') && permissions.canReview && (
                  <Button onClick={() => reopenMutation.mutate()} loading={reopenMutation.isPending}>
                    Reopen for review
                  </Button>
                )}
                {status === 'UNDER_REVIEW' && permissions.canWaitlist && (
                  <Button onClick={() => waitlistMutation.mutate()} loading={waitlistMutation.isPending}>
                    Waitlist
                  </Button>
                )}
                {status === 'UNDER_REVIEW' && permissions.canReject && (
                  <Popconfirm
                    title="Reject this application?"
                    description="A reason is required and will be emailed to the applicant."
                    onConfirm={() => {
                      if (!notes.trim()) {
                        message.warning('Enter a reason before rejecting.');
                        return;
                      }
                      rejectMutation.mutate();
                    }}
                  >
                    <Button danger loading={rejectMutation.isPending}>
                      Reject
                    </Button>
                  </Popconfirm>
                )}
                {status === 'UNDER_REVIEW' && permissions.canApprove && (
                  <Popconfirm
                    title="Approve this application?"
                    description="This creates a real student record and a parent portal account."
                    onConfirm={() => approveMutation.mutate()}
                  >
                    <Button type="primary" loading={approveMutation.isPending} disabled={busy}>
                      Approve
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

export default AdmissionDetailDrawer;
