import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Result, Typography, theme } from 'antd';
import {
  IdcardOutlined,
  LockOutlined,
  MailOutlined,
  ShopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  DuplicateSchoolIdentifierError,
  RegistrationError,
  registerSchool,
} from '../../api/onboarding';

const { Title, Text } = Typography;

const IDENTIFIER_HELP =
  "This will be your school's unique code for logging in — lowercase letters, numbers, and hyphens only";
const IDENTIFIER_INVALID =
  "Must be 3-50 characters: letters, numbers, and hyphens only, and can't start or end with a hyphen";
const PASSWORD_HELP = 'At least 8 characters, including a letter and a number';
const PASSWORD_INVALID = 'Must be at least 8 characters and include a letter and a number';

// Mirrors OnboardingDtos.RegisterSchoolRequest on the backend exactly, so the form
// catches bad input before it ever reaches the server.
const registerSchema = z
  .object({
    schoolName: z.string().trim().min(1, 'School name is required').max(200),
    schoolIdentifier: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, IDENTIFIER_INVALID),
    adminFullName: z.string().trim().min(1, "Admin's full name is required").max(200),
    adminEmail: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address')
      .max(320),
    adminPassword: z.string().regex(/^(?=.*[A-Za-z])(?=.*\d).{8,100}$/, PASSWORD_INVALID),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function RegisterSchoolForm() {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredIdentifier, setRegisteredIdentifier] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      schoolName: '',
      schoolIdentifier: '',
      adminFullName: '',
      adminEmail: '',
      adminPassword: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const mutation = useMutation({
    mutationFn: registerSchool,
    onSuccess: (response) => {
      setRegisteredIdentifier(response.schoolIdentifier);
    },
    onError: (error) => {
      if (error instanceof DuplicateSchoolIdentifierError) {
        setError('schoolIdentifier', { message: error.message });
        return;
      }
      setFormError(
        error instanceof RegistrationError
          ? error.message
          : 'Unable to register your school right now. Please try again in a moment.',
      );
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    const { confirmPassword: _confirmPassword, ...payload } = values;
    mutation.mutate(payload);
  });

  if (registeredIdentifier) {
    return (
      <CenteredCard>
        <Result
          status="success"
          title="Your school has been registered!"
          subTitle={
            <>
              Sign in with your school code (<strong>{registeredIdentifier}</strong>) and admin
              email to get started.
            </>
          }
          extra={
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(`/login?school=${encodeURIComponent(registeredIdentifier)}`)}
            >
              Continue to sign in
            </Button>
          }
        />
      </CenteredCard>
    );
  }

  return (
    <CenteredCard wide>
      <div style={{ marginBottom: token.marginLG }}>
        <Text strong style={{ color: token.colorPrimary, letterSpacing: 1 }}>
          SCHOOL MANAGEMENT
        </Text>
        <Title level={3} style={{ marginTop: token.marginXS, marginBottom: token.marginXXS }}>
          Register your school
        </Title>
        <Text type="secondary">Set up your school and its first admin account.</Text>
      </div>

      {formError && (
        <Alert type="error" message={formError} showIcon style={{ marginBottom: token.marginMD }} />
      )}

      <Form layout="vertical" onFinish={onSubmit} noValidate requiredMark={false}>
        <Controller
          control={control}
          name="schoolName"
          render={({ field }) => (
            <Form.Item
              label="School name"
              validateStatus={errors.schoolName ? 'error' : undefined}
              help={errors.schoolName?.message}
            >
              <Input
                {...field}
                size="large"
                autoComplete="organization"
                prefix={<ShopOutlined />}
                placeholder="e.g. Springfield Elementary"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="schoolIdentifier"
          render={({ field }) => (
            <Form.Item
              label="School identifier"
              validateStatus={errors.schoolIdentifier ? 'error' : undefined}
              help={errors.schoolIdentifier?.message ?? IDENTIFIER_HELP}
            >
              <Input
                {...field}
                size="large"
                autoComplete="off"
                prefix={<IdcardOutlined />}
                placeholder="e.g. springfield-elementary"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="adminFullName"
          render={({ field }) => (
            <Form.Item
              label="Admin full name"
              validateStatus={errors.adminFullName ? 'error' : undefined}
              help={errors.adminFullName?.message}
            >
              <Input
                {...field}
                size="large"
                autoComplete="name"
                prefix={<UserOutlined />}
                placeholder="e.g. Seymour Skinner"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="adminEmail"
          render={({ field }) => (
            <Form.Item
              label="Admin email"
              validateStatus={errors.adminEmail ? 'error' : undefined}
              help={errors.adminEmail?.message}
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
          name="adminPassword"
          render={({ field }) => (
            <Form.Item
              label="Admin password"
              validateStatus={errors.adminPassword ? 'error' : undefined}
              help={errors.adminPassword?.message ?? PASSWORD_HELP}
            >
              <Input.Password
                {...field}
                size="large"
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder="Choose a password"
              />
            </Form.Item>
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field }) => (
            <Form.Item
              label="Confirm password"
              validateStatus={errors.confirmPassword ? 'error' : undefined}
              help={errors.confirmPassword?.message}
            >
              <Input.Password
                {...field}
                size="large"
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder="Re-enter your password"
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
          Register school
        </Button>
      </Form>

      <div style={{ marginTop: token.marginLG, textAlign: 'center' }}>
        <Text type="secondary">
          Already have a school account? <Link to="/login">Sign in</Link>
        </Text>
      </div>
    </CenteredCard>
  );
}

function CenteredCard({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const { token } = theme.useToken();
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
        style={{ width: '100%', maxWidth: wide ? 480 : 400, boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingXL } }}
      >
        {children}
      </Card>
    </div>
  );
}

export default RegisterSchoolForm;
