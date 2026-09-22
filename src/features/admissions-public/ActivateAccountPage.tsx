import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Result, Typography, theme } from 'antd';
import { activateAccount } from '../../api/admissions';

const { Title, Text } = Typography;

const schema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

type FormValues = z.infer<typeof schema>;

/** Consumes the portal-invitation link a newly-approved parent's admission email points to. */
function ActivateAccountPage() {
  const { token: theToken } = theme.useToken();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activationToken = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' }, mode: 'onTouched' });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => activateAccount(activationToken, values.password),
    onSuccess: () => setDone(true),
    onError: () => setFormError('This activation link is invalid or has expired. Please contact the school office for a new one.'),
  });

  const submit = handleSubmit((values) => {
    setFormError(null);
    mutation.mutate(values);
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theToken.paddingLG, background: theToken.colorBgLayout }}>
      <Card style={{ width: '100%', maxWidth: 440, boxShadow: theToken.boxShadowTertiary }}>
        {done ? (
          <Result status="success" title="Account activated" subTitle="You can now sign in with your new password." extra={<Button type="primary" onClick={() => navigate('/login')}>Go to sign in</Button>} />
        ) : !activationToken ? (
          <Result status="warning" title="Missing activation link" subTitle="Please use the link from your invitation email." />
        ) : (
          <>
            <Title level={3} style={{ marginTop: 0 }}>
              Activate your parent portal account
            </Title>
            <Text type="secondary">Set a password to finish creating your account.</Text>

            {formError && <Alert type="error" message={formError} showIcon style={{ margin: `${theToken.marginMD}px 0` }} />}

            <Form layout="vertical" onFinish={submit} style={{ marginTop: theToken.marginMD }} requiredMark={false}>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <Form.Item label="New password" validateStatus={errors.password ? 'error' : undefined} help={errors.password?.message}>
                    <Input.Password {...field} autoComplete="new-password" />
                  </Form.Item>
                )}
              />
              <Controller
                control={control}
                name="confirm"
                render={({ field }) => (
                  <Form.Item label="Confirm password" validateStatus={errors.confirm ? 'error' : undefined} help={errors.confirm?.message}>
                    <Input.Password {...field} autoComplete="new-password" />
                  </Form.Item>
                )}
              />
              <Button type="primary" htmlType="submit" block loading={mutation.isPending}>
                Activate account
              </Button>
            </Form>
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: theToken.marginLG }}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}

export default ActivateAccountPage;
