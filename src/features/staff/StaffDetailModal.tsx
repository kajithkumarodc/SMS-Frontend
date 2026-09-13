import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  List,
  Modal,
  Skeleton,
  Space,
  Tag,
  Typography,
  theme,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { fetchLeaveRequests, type StaffProfile } from '../../api/staff';
import { LEAVE_REQUESTS_KEY } from './queryKeys';
import { LEAVE_STATUS_TAG_COLOR, STAFF_STATUS_TAG_COLOR, statusLabel } from './status';
import { formatDate } from './format';
import GeneratePayrollModal from './GeneratePayrollModal';

const { Text } = Typography;

type Props = {
  /** The staff member to show, or null when the modal is closed. */
  staff: StaffProfile | null;
  onClose: () => void;
};

function StaffDetailModal({ staff, onClose }: Props) {
  const { token } = theme.useToken();
  const open = staff !== null;
  const [generatingPayroll, setGeneratingPayroll] = useState(false);

  const leaveQuery = useQuery({
    queryKey: [...LEAVE_REQUESTS_KEY, { staffUserId: staff?.userId }],
    queryFn: () => fetchLeaveRequests({ staffUserId: staff!.userId }),
    enabled: open,
  });

  const leaveRequests = leaveQuery.data ?? [];

  return (
    <>
      <Modal
        title={staff ? staff.fullName : 'Staff member'}
        open={open}
        onCancel={onClose}
        footer={null}
        width={640}
        destroyOnClose
      >
        {staff && (
          <Space direction="vertical" size={token.marginLG} style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Employee code">{staff.employeeCode}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STAFF_STATUS_TAG_COLOR[staff.status]} style={{ marginInlineEnd: 0 }}>
                  {statusLabel(staff.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{staff.email}</Descriptions.Item>
              <Descriptions.Item label="Date of joining">{formatDate(staff.dateOfJoining)}</Descriptions.Item>
              <Descriptions.Item label="Department">{staff.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{staff.designation || '—'}</Descriptions.Item>
            </Descriptions>

            <div>
              <Space
                style={{ width: '100%', justifyContent: 'space-between', marginBottom: token.marginSM }}
              >
                <Text strong>Leave requests</Text>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setGeneratingPayroll(true)}
                >
                  Generate payroll
                </Button>
              </Space>

              {leaveQuery.isError ? (
                <Alert type="warning" showIcon message="Couldn't load leave requests" />
              ) : leaveQuery.isPending ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : leaveRequests.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No leave requests yet" />
              ) : (
                <List
                  size="small"
                  dataSource={leaveRequests}
                  rowKey={(request) => request.id}
                  renderItem={(request) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{request.leaveType}</Text>
                            <Tag color={LEAVE_STATUS_TAG_COLOR[request.status]} style={{ marginInlineEnd: 0 }}>
                              {statusLabel(request.status)}
                            </Tag>
                          </Space>
                        }
                        description={
                          <>
                            {formatDate(request.startDate)} – {formatDate(request.endDate)}
                            {request.reason ? ` · ${request.reason}` : ''}
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Space>
        )}
      </Modal>

      <GeneratePayrollModal
        staff={generatingPayroll ? staff : null}
        onClose={() => setGeneratingPayroll(false)}
      />
    </>
  );
}

export default StaffDetailModal;
