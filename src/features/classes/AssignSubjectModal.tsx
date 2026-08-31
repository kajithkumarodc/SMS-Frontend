import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Modal, Select } from 'antd';
import { assignClassSubject, type Subject } from '../../api/classes';
import { CLASS_SUBJECTS_QUERY_KEY } from './queryKeys';

type Props = {
  open: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  /** Subjects that exist but are not yet assigned to this class. */
  availableSubjects: Subject[];
  /** True when there are no subjects at all in the tenant. */
  noSubjectsAtAll: boolean;
};

function AssignSubjectModal({ open, onClose, classId, className, availableSubjects, noSubjectsAtAll }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState<string>();
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setSubjectId(undefined);
      setTouched(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!subjectId) return Promise.reject(new Error('No subject selected'));
      return assignClassSubject(classId, subjectId);
    },
    onSuccess: (assigned) => {
      message.success(`"${assigned.name}" assigned to ${className}`);
      void queryClient.invalidateQueries({ queryKey: [...CLASS_SUBJECTS_QUERY_KEY, classId] });
      onClose();
    },
    onError: () => {
      message.error('Could not assign the subject. Please try again.');
    },
  });

  const submit = () => {
    setTouched(true);
    if (subjectId) mutation.mutate();
  };

  const allAssigned = !noSubjectsAtAll && availableSubjects.length === 0;

  return (
    <Modal
      title={`Assign a subject to ${className}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Assign"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: noSubjectsAtAll || allAssigned }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noSubjectsAtAll && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="No subjects yet"
          description="Add a subject in the Subjects section above first."
        />
      )}
      {allAssigned && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="All set"
          description="Every subject is already assigned to this class."
        />
      )}
      {!noSubjectsAtAll && !allAssigned && (
        <Form layout="vertical">
          <Form.Item
            label="Subject"
            required
            validateStatus={touched && !subjectId ? 'error' : undefined}
            help={touched && !subjectId ? 'Select a subject' : undefined}
          >
            <Select
              value={subjectId}
              onChange={setSubjectId}
              placeholder="Select a subject"
              options={availableSubjects.map((s) => ({ value: s.id, label: s.name }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default AssignSubjectModal;
