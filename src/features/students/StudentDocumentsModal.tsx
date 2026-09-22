import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Empty, List, Modal, Popconfirm, Select, Skeleton, Space, Typography, Upload, theme } from 'antd';
import { DeleteOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import {
  deleteDocument,
  documentDownloadUrl,
  fetchDocuments,
  uploadDocument,
  UnsupportedFileTypeError,
  type Student,
  type StudentDocument,
} from '../../api/students';
import { STUDENT_DOCUMENTS_KEY } from './queryKeys';

const { Text } = Typography;
const { Dragger } = Upload;

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'BIRTH_CERTIFICATE', label: 'Birth certificate' },
  { value: 'TRANSFER_CERTIFICATE', label: 'Transfer certificate' },
  { value: 'PREVIOUS_SCHOOL_CERTIFICATE', label: 'Previous school certificate' },
  { value: 'STUDENT_ID', label: 'Student ID' },
  { value: 'GUARDIAN_ID', label: 'Parent / guardian ID' },
  { value: 'OTHER', label: 'Other' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  /** The student whose documents are being managed, or null when the modal is closed. */
  student: Student | null;
  onClose: () => void;
  canUpload: boolean;
  canDelete: boolean;
};

function StudentDocumentsModal({ student, onClose, canUpload, canDelete }: Props) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = student !== null;
  const [documentType, setDocumentType] = useState('OTHER');

  const documentsQuery = useQuery({
    queryKey: student ? [...STUDENT_DOCUMENTS_KEY, student.id] : STUDENT_DOCUMENTS_KEY,
    queryFn: () => fetchDocuments(student!.id),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (!student) return Promise.reject(new Error('No student'));
      return uploadDocument(student.id, file, documentType);
    },
    onSuccess: () => {
      message.success('Document uploaded');
      if (student) void queryClient.invalidateQueries({ queryKey: [...STUDENT_DOCUMENTS_KEY, student.id] });
    },
    onError: (error) => {
      message.error(error instanceof UnsupportedFileTypeError ? error.message : 'Could not upload the document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => {
      if (!student) return Promise.reject(new Error('No student'));
      return deleteDocument(student.id, documentId);
    },
    onSuccess: () => {
      message.success('Document deleted');
      if (student) void queryClient.invalidateQueries({ queryKey: [...STUDENT_DOCUMENTS_KEY, student.id] });
    },
    onError: () => message.error('Could not delete the document'),
  });

  const uploadProps: UploadProps = {
    multiple: false,
    showUploadList: false,
    disabled: uploadMutation.isPending,
    beforeUpload: (file) => {
      uploadMutation.mutate(file as unknown as File);
      return false;
    },
  };

  const documents = documentsQuery.data ?? [];

  return (
    <Modal
      title={student ? `Documents — ${student.fullName}` : 'Documents'}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
      width={640}
      destroyOnClose
    >
      {canUpload && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: token.marginMD }}>
          <Select
            style={{ width: '100%' }}
            value={documentType}
            onChange={setDocumentType}
            options={DOCUMENT_TYPE_OPTIONS}
          />
          <Dragger {...uploadProps} style={{ padding: token.paddingSM }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>Click or drag a file to upload</p>
            <Text type="secondary" style={{ fontSize: 12 }}>
              PDF, JPG, PNG, WEBP, DOC, DOCX — up to 10 MB
            </Text>
          </Dragger>
          {uploadMutation.isPending && <Text type="secondary">Uploading…</Text>}
        </Space>
      )}

      {documentsQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : documents.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No documents uploaded yet" />
      ) : (
        <List<StudentDocument>
          dataSource={documents}
          renderItem={(doc) => (
            <List.Item
              actions={[
                <Button
                  key="download"
                  type="link"
                  icon={<DownloadOutlined />}
                  href={documentDownloadUrl(student!.id, doc.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </Button>,
                canDelete && (
                  <Popconfirm
                    key="delete"
                    title="Delete this document?"
                    description="This cannot be undone."
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutate(doc.id)}
                  >
                    <Button type="link" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending}>
                      Delete
                    </Button>
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={doc.originalFilename}
                description={
                  <Space size="small" wrap>
                    <Text type="secondary">{DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.documentType)?.label ?? doc.documentType}</Text>
                    <Text type="secondary">·</Text>
                    <Text type="secondary">{formatSize(doc.fileSizeBytes)}</Text>
                    <Text type="secondary">·</Text>
                    <Text type="secondary">{dayjs(doc.uploadedAt).format('D MMM YYYY, HH:mm')}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}

export default StudentDocumentsModal;
