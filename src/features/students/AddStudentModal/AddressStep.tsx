import type { CSSProperties } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Divider, Form, Input, Select, Space, Switch, Typography, theme } from 'antd';
import { LANGUAGE_OPTIONS, type FormValues } from './schema';

const { Text } = Typography;

type Props = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
};

function AddressStep({ control, errors }: Props) {
  const { token } = theme.useToken();

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    columnGap: token.marginLG,
    rowGap: 0,
  };

  return (
    <div>
      <Text strong>Address</Text>
      <div style={{ marginTop: token.marginSM }}>
        <Controller
          control={control}
          name="addressLine1"
          render={({ field }) => (
            <Form.Item
              label="Address line 1"
              required
              validateStatus={errors.addressLine1 ? 'error' : undefined}
              help={errors.addressLine1?.message}
            >
              <Input {...field} placeholder="House / street" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="addressLine2"
          render={({ field }) => (
            <Form.Item
              label="Address line 2"
              validateStatus={errors.addressLine2 ? 'error' : undefined}
              help={errors.addressLine2?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
            </Form.Item>
          )}
        />
        <div style={gridStyle}>
          <Controller
            control={control}
            name="city"
            render={({ field }) => (
              <Form.Item
                label="City"
                required
                validateStatus={errors.city ? 'error' : undefined}
                help={errors.city?.message}
              >
                <Input {...field} placeholder="e.g. Chennai" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="state"
            render={({ field }) => (
              <Form.Item
                label="State"
                required
                validateStatus={errors.state ? 'error' : undefined}
                help={errors.state?.message}
              >
                <Input {...field} placeholder="e.g. Tamil Nadu" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="pincode"
            render={({ field }) => (
              <Form.Item
                label="PIN code"
                required
                validateStatus={errors.pincode ? 'error' : undefined}
                help={errors.pincode?.message}
              >
                <Input {...field} placeholder="e.g. 600028" autoComplete="off" inputMode="numeric" maxLength={6} />
              </Form.Item>
            )}
          />
        </div>
      </div>

      <Divider style={{ margin: `${token.marginMD}px 0` }} />

      <Text strong>Communication preferences</Text>
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: token.marginSM }}>
        Used for attendance, fee reminders, exam results, circulars, and emergency notifications.
      </Text>

      <Space direction="vertical" size={token.marginSM} style={{ width: '100%' }}>
        <Controller
          control={control}
          name="smsNotificationsEnabled"
          render={({ field }) => (
            <Form.Item label="SMS notifications" style={{ marginBottom: 0 }}>
              <Switch checked={field.value} onChange={field.onChange} />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="whatsappNotificationsEnabled"
          render={({ field }) => (
            <Form.Item label="WhatsApp notifications" style={{ marginBottom: 0 }}>
              <Switch checked={field.value} onChange={field.onChange} />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="emailNotificationsEnabled"
          render={({ field }) => (
            <Form.Item label="Email notifications" style={{ marginBottom: 0 }}>
              <Switch checked={field.value} onChange={field.onChange} />
            </Form.Item>
          )}
        />
      </Space>

      <Controller
        control={control}
        name="preferredLanguage"
        render={({ field }) => (
          <Form.Item
            label="Preferred communication language"
            style={{ marginTop: token.marginMD }}
            validateStatus={errors.preferredLanguage ? 'error' : undefined}
            help={errors.preferredLanguage?.message}
          >
            <Select {...field} options={LANGUAGE_OPTIONS} style={{ maxWidth: 280 }} />
          </Form.Item>
        )}
      />
    </div>
  );
}

export default AddressStep;
