import type { CSSProperties } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Divider, Form, Input, Select, Typography, theme } from 'antd';
import { RELATIONSHIP_OPTIONS, type FormValues } from './schema';

const { Text } = Typography;

type Props = {
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
};

function GuardianStep({ control, errors }: Props) {
  const { token } = theme.useToken();

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    columnGap: token.marginLG,
    rowGap: 0,
  };

  return (
    <div>
      <Text strong>Primary guardian</Text>
      <div style={{ marginTop: token.marginSM }}>
        <div style={gridStyle}>
          <Controller
            control={control}
            name="guardianName"
            render={({ field }) => (
              <Form.Item
                label="Guardian name"
                required
                validateStatus={errors.guardianName ? 'error' : undefined}
                help={errors.guardianName?.message}
              >
                <Input {...field} placeholder="e.g. Anil Sharma" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="guardianRelationship"
            render={({ field }) => (
              <Form.Item
                label="Relationship"
                required
                validateStatus={errors.guardianRelationship ? 'error' : undefined}
                help={errors.guardianRelationship?.message}
              >
                <Select {...field} placeholder="Select relationship" options={RELATIONSHIP_OPTIONS} />
              </Form.Item>
            )}
          />
        </div>
        <div style={gridStyle}>
          <Controller
            control={control}
            name="guardianPhone"
            render={({ field }) => (
              <Form.Item
                label="Mobile number"
                required
                validateStatus={errors.guardianPhone ? 'error' : undefined}
                help={errors.guardianPhone?.message}
              >
                <Input {...field} placeholder="e.g. +91 98765 43210" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="guardianAlternatePhone"
            render={({ field }) => (
              <Form.Item
                label="Alternate mobile number"
                validateStatus={errors.guardianAlternatePhone ? 'error' : undefined}
                help={errors.guardianAlternatePhone?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
        </div>
        <div style={gridStyle}>
          <Controller
            control={control}
            name="guardianEmail"
            render={({ field }) => (
              <Form.Item
                label="Email"
                validateStatus={errors.guardianEmail ? 'error' : undefined}
                help={errors.guardianEmail?.message}
              >
                <Input
                  {...field}
                  value={field.value ?? ''}
                  type="email"
                  placeholder="e.g. anil.sharma@example.com"
                  autoComplete="off"
                />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="guardianOccupation"
            render={({ field }) => (
              <Form.Item
                label="Occupation"
                validateStatus={errors.guardianOccupation ? 'error' : undefined}
                help={errors.guardianOccupation?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
        </div>
      </div>

      <Divider style={{ margin: `${token.marginMD}px 0` }} />

      <Text strong>Parent details</Text>
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: token.marginSM }}>
        Optional — fill in if different from the primary guardian above.
      </Text>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', columnGap: token.marginLG }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Father
          </Text>
          <Controller
            control={control}
            name="fatherName"
            render={({ field }) => (
              <Form.Item
                label="Father's name"
                validateStatus={errors.fatherName ? 'error' : undefined}
                help={errors.fatherName?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="fatherMobile"
            render={({ field }) => (
              <Form.Item
                label="Father's mobile"
                validateStatus={errors.fatherMobile ? 'error' : undefined}
                help={errors.fatherMobile?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="fatherEmail"
            render={({ field }) => (
              <Form.Item
                label="Father's email"
                validateStatus={errors.fatherEmail ? 'error' : undefined}
                help={errors.fatherEmail?.message}
              >
                <Input {...field} value={field.value ?? ''} type="email" placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="fatherOccupation"
            render={({ field }) => (
              <Form.Item
                label="Father's occupation"
                validateStatus={errors.fatherOccupation ? 'error' : undefined}
                help={errors.fatherOccupation?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Mother
          </Text>
          <Controller
            control={control}
            name="motherName"
            render={({ field }) => (
              <Form.Item
                label="Mother's name"
                validateStatus={errors.motherName ? 'error' : undefined}
                help={errors.motherName?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="motherMobile"
            render={({ field }) => (
              <Form.Item
                label="Mother's mobile"
                validateStatus={errors.motherMobile ? 'error' : undefined}
                help={errors.motherMobile?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="motherEmail"
            render={({ field }) => (
              <Form.Item
                label="Mother's email"
                validateStatus={errors.motherEmail ? 'error' : undefined}
                help={errors.motherEmail?.message}
              >
                <Input {...field} value={field.value ?? ''} type="email" placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
          <Controller
            control={control}
            name="motherOccupation"
            render={({ field }) => (
              <Form.Item
                label="Mother's occupation"
                validateStatus={errors.motherOccupation ? 'error' : undefined}
                help={errors.motherOccupation?.message}
              >
                <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
              </Form.Item>
            )}
          />
        </div>
      </div>

      <Divider style={{ margin: `${token.marginMD}px 0` }} />

      <Text strong>Emergency contact</Text>
      <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: token.marginSM }}>
        Optional — someone to reach if the guardian above is unreachable.
      </Text>
      <div style={gridStyle}>
        <Controller
          control={control}
          name="emergencyContactName"
          render={({ field }) => (
            <Form.Item
              label="Contact name"
              validateStatus={errors.emergencyContactName ? 'error' : undefined}
              help={errors.emergencyContactName?.message}
            >
              <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="emergencyContactRelationship"
          render={({ field }) => (
            <Form.Item
              label="Relationship to student"
              validateStatus={errors.emergencyContactRelationship ? 'error' : undefined}
              help={errors.emergencyContactRelationship?.message}
            >
              <Select {...field} allowClear placeholder="Optional" options={RELATIONSHIP_OPTIONS} />
            </Form.Item>
          )}
        />
      </div>
      <Controller
        control={control}
        name="emergencyContactMobile"
        render={({ field }) => (
          <Form.Item
            label="Emergency mobile number"
            validateStatus={errors.emergencyContactMobile ? 'error' : undefined}
            help={errors.emergencyContactMobile?.message}
          >
            <Input {...field} value={field.value ?? ''} placeholder="Optional" autoComplete="off" />
          </Form.Item>
        )}
      />
    </div>
  );
}

export default GuardianStep;
