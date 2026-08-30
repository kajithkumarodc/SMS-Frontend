import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Typography, theme } from 'antd';
import { BankOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { login, LoginError } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const DASHBOARD_ROUTE = '/app/dashboard';

const loginSchema = z.object({
  schoolIdentifier: z.string().min(1, 'School code is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEFAULT_SCHOOL_IDENTIFIER = import.meta.env.VITE_DEFAULT_SCHOOL_IDENTIFIER ?? '';

function LoginForm() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.login);
  const { token } = theme.useToken();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { schoolIdentifier: DEFAULT_SCHOOL_IDENTIFIER, email: '', password: '' },
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      setSession(user);
      navigate(DASHBOARD_ROUTE, { replace: true });
    },
    onError: (error) => {
      setFormError(
        error instanceof LoginError
          ? error.message
          : 'Unable to sign in right now. Please try again in a moment.',
      );
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: token.paddingLG,
        background: token.colorBgLayout,
      }}
    >
      <Card
        style={{ width: '100%', maxWidth: 400, boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingXL } }}
      >
        <div style={{ marginBottom: token.marginLG }}>
          <Text strong style={{ color: token.colorPrimary, letterSpacing: 1 }}>
            SCHOOL MANAGEMENT
          </Text>
          <Title level={3} style={{ marginTop: token.marginXS, marginBottom: token.marginXXS }}>
            Sign in
          </Title>
          <Text type="secondary">Use your school account to continue.</Text>
        </div>

        {formError && (
          <Alert
            type="error"
            message={formError}
            showIcon
            style={{ marginBottom: token.marginMD }}
          />
        )}

        <Form layout="vertical" onFinish={onSubmit} noValidate requiredMark={false}>
          <Controller
            control={control}
            name="schoolIdentifier"
            render={({ field }) => (
              <Form.Item
                label="School code"
                validateStatus={errors.schoolIdentifier ? 'error' : undefined}
                help={errors.schoolIdentifier?.message ?? 'The short code or subdomain for your school.'}
              >
                <Input
                  {...field}
                  size="large"
                  autoComplete="organization"
                  prefix={<BankOutlined />}
                  placeholder="e.g. springfield-high"
                />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Form.Item
                label="Email"
                validateStatus={errors.email ? 'error' : undefined}
                help={errors.email?.message}
              >
                <Input
                  {...field}
                  size="large"
                  type="email"
                  autoComplete="email"
                  prefix={<MailOutlined />}
                  placeholder="you@school.edu"
                />
              </Form.Item>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Form.Item
                label="Password"
                validateStatus={errors.password ? 'error' : undefined}
                help={errors.password?.message}
              >
                <Input.Password
                  {...field}
                  size="large"
                  autoComplete="current-password"
                  prefix={<LockOutlined />}
                  placeholder="Your password"
                />
              </Form.Item>
            )}
          />

          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={mutation.isPending}
            style={{ marginTop: token.marginXS }}
          >
            Sign in
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default LoginForm;
