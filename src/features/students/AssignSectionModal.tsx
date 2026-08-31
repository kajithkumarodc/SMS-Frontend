import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Form, Modal, Select } from 'antd';
import { fetchClasses } from '../../api/classes';
import { assignStudentSection, type Student } from '../../api/students';
import { CLASSES_QUERY_KEY } from '../classes/queryKeys';
import { buildSectionSelectOptions } from '../classes/sectionLookup';
import { STUDENTS_QUERY_KEY } from './queryKeys';

type Props = {
  /** The student to assign; `null` keeps the modal closed. */
  student: Student | null;
  onClose: () => void;
};

function AssignSectionModal({ student, onClose }: Props) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [sectionId, setSectionId] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const classesQuery = useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: fetchClasses,
    enabled: student !== null,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setSectionId(student?.sectionId ?? undefined);
    setTouched(false);
  }, [student]);

  const options = buildSectionSelectOptions(classesQuery.data);
  const noSections = classesQuery.isSuccess && options.length === 0;

  const mutation = useMutation({
    mutationFn: () => {
      if (!student || !sectionId) {
        return Promise.reject(new Error('Nothing to assign'));
      }
      return assignStudentSection(student.id, sectionId);
    },
    onSuccess: () => {
      message.success(`${student?.fullName ?? 'Student'} assigned`);
      void queryClient.invalidateQueries({ queryKey: STUDENTS_QUERY_KEY });
      onClose();
    },
    onError: () => {
      message.error('Could not assign the section. Please try again.');
    },
  });

  const submit = () => {
    setTouched(true);
    if (sectionId) {
      mutation.mutate();
    }
  };

  return (
    <Modal
      title={student ? `Assign ${student.fullName} to a section` : 'Assign section'}
      open={student !== null}
      onCancel={onClose}
      onOk={submit}
      okText="Assign"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: classesQuery.isLoading || noSections }}
      destroyOnClose
      maskClosable={!mutation.isPending}
    >
      {noSections && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No sections available"
          description="Create a class and at least one section on the Classes page first."
        />
      )}
      <Form layout="vertical">
        <Form.Item
          label="Section"
          required
          validateStatus={touched && !sectionId ? 'error' : undefined}
          help={touched && !sectionId ? 'Select a section' : undefined}
        >
          <Select
            value={sectionId}
            onChange={setSectionId}
            placeholder="Select a section"
            loading={classesQuery.isLoading}
            options={options}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default AssignSectionModal;
