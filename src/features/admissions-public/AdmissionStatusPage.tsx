import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Alert, Button, Card, Descriptions, Form, Input, Tag, Typography, theme } from 'antd';
import { fetchPublicApplicationStatus, type AdmissionApplicationStatus } from '../../api/admissions';

const { Title, Text } = Typography;

const STATUS_COLOR: Record<AdmissionApplicationStatus, string> = {
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'gold',
  WAITLISTED: 'purple',
  APPROVED: 'green',
  REJECTED: 'red',
};

const schema = z.object({
  applicationNumber: z.string().trim().min(1, 'Application reference is required'),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

function AdmissionStatusPage() {
  const { token } = theme.useToken();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { applicationNumber: '', email: '' }, mode: 'onTouched' });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => fetchPublicApplicationStatus(values.applicationNumber.trim(), values.email.trim()),
    onError: (error) => {
      setFormError(
        error instanceof AxiosError && error.response?.status === 404
          ? 'Application not found -- check your reference number and the email you applied with.'
          : 'Could not look up this application right now. Please try again.',
      );
    },
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: token.paddingLG, background: token.colorBgLayout }}>
      <Card style={{ width: '100%', maxWidth: 480, boxShadow: token.boxShadowTertiary }}>
        <Title level={3} style={{ marginTop: 0 }}>
          Check your application status
        </Title>
        <Text type="secondary">Enter your application reference and the email you applied with.</Text>

        {formError && <Alert type="error" message={formError} showIcon style={{ margin: `${token.marginMD}px 0` }} />}

        <Form layout="vertical" onFinish={submit} style={{ marginTop: token.marginMD }} requiredMark={false}>
          <Controller
            control={control}
            name="applicationNumber"
            render={({ field }) => (
              <Form.Item label="Application reference" validateStatus={errors.applicationNumber ? 'error' : undefined} help={errors.applicationNumber?.message}>
                <Input {...field} data-testid="admission-status-reference-input" placeholder="APP-000001" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Form.Item label="Email" validateStatus={errors.email ? 'error' : undefined} help={errors.email?.message}>
                <Input {...field} data-testid="admission-status-email-input" placeholder="you@example.com" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
            Check status
          </Button>
        </Form>

        {mutation.data && (
          <Descriptions column={1} size="small" bordered style={{ marginTop: token.marginLG }}>
            <Descriptions.Item label="Reference">{mutation.data.applicationNumber}</Descriptions.Item>
            <Descriptions.Item label="Admission cycle">{mutation.data.admissionCycleName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[mutation.data.status]}>{mutation.data.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Submitted">{new Date(mutation.data.submittedAt).toLocaleDateString()}</Descriptions.Item>
            <Descriptions.Item label="Last updated">{new Date(mutation.data.updatedAt).toLocaleDateString()}</Descriptions.Item>
            <Descriptions.Item label="Message">{mutation.data.message}</Descriptions.Item>
          </Descriptions>
        )}

        <div style={{ textAlign: 'center', marginTop: token.marginLG }}>
          <Link to="/admissions/apply">Start a new application</Link>
        </div>
      </Card>
    </div>
  );
}

export default AdmissionStatusPage;
