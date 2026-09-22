import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { recordFollowUp, type Enquiry, type FollowUpType } from '../../api/enquiries';
import { FOLLOW_UP_TYPE_OPTIONS } from './status';
import { ENQUIRIES_KEY, ENQUIRY_KEY, ENQUIRY_SUMMARY_KEY, FOLLOW_UPS_KEY } from './queryKeys';

const schema = z.object({
  followUpDate: z.string().min(1, 'Pick a follow-up date'),
  followUpType: z.string().min(1, 'Select a type'),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  followUpDate: dayjs().format('YYYY-MM-DD'),
  followUpType: 'CALL',
  notes: '',
  nextFollowUpDate: '',
};

type Props = {
  /** The enquiry to record a follow-up against, or null when the modal is closed. */
  enquiry: Enquiry | null;
  onClose: () => void;
};

function RecordFollowUpModal({ enquiry, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const open = enquiry !== null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: 'onTouched' });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!enquiry) return Promise.reject(new Error('No enquiry'));
      return recordFollowUp(enquiry.id, {
        followUpDate: values.followUpDate,
        followUpType: values.followUpType as FollowUpType,
        notes: values.notes?.trim() || null,
        nextFollowUpDate: values.nextFollowUpDate || null,
      });
    },
    onSuccess: () => {
      message.success('Follow-up recorded');
      if (enquiry) {
        void queryClient.invalidateQueries({ queryKey: [...FOLLOW_UPS_KEY, enquiry.id] });
        void queryClient.invalidateQueries({ queryKey: [...ENQUIRY_KEY, enquiry.id] });
      }
      void queryClient.invalidateQueries({ queryKey: ENQUIRIES_KEY });
      void queryClient.invalidateQueries({ queryKey: ENQUIRY_SUMMARY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not record the follow-up. Please try again.');
    },
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  return (
    <Modal
      title={enquiry ? `Record follow-up — ${enquiry.applicantName}` : 'Record follow-up'}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Record follow-up"
      confirmLoading={mutation.isPending}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      <Form layout="vertical" requiredMark="optional" onFinish={submit}>
        <Controller
          control={control}
          name="followUpDate"
          render={({ field }) => (
            <Form.Item
              label="Follow-up date"
              required
              validateStatus={errors.followUpDate ? 'error' : undefined}
              help={errors.followUpDate?.message}
            >
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
              />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="followUpType"
          render={({ field }) => (
            <Form.Item label="Type" required>
              <Select {...field} options={FOLLOW_UP_TYPE_OPTIONS} />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Form.Item label="Notes" help="Optional">
              <Input.TextArea {...field} rows={3} />
            </Form.Item>
          )}
        />
        <Controller
          control={control}
          name="nextFollowUpDate"
          render={({ field }) => (
            <Form.Item label="Next follow-up date" help="Optional">
              <DatePicker
                style={{ width: '100%' }}
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d ? d.format('YYYY-MM-DD') : '')}
              />
            </Form.Item>
          )}
        />
      </Form>
    </Modal>
  );
}

export default RecordFollowUpModal;
