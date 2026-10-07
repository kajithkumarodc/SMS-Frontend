import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Col, Descriptions, Input, Modal, Row, Select, Spin, Table, Tag } from 'antd';
import { EyeOutlined, SendOutlined } from '@ant-design/icons';
import { fetchStaffLeaves } from '../../../../api/staffMembers';
import { HALF_DAY_LABEL, LEAVE_STATUS_LABEL, type LeaveRequestRow, type LeaveStatus } from '../../../../api/leaveManagement';
import { formatDisplayDate } from '../../../../lib/dates';
import StatCard from './StatCard';

const STATUS_COLOR: Record<LeaveStatus, string> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };

const leaveRange = (r: LeaveRequestRow) => `${formatDisplayDate(r.fromDate)} - ${formatDisplayDate(r.toDate)}`;

/** Staff profile > Leaves: the year's balance per leave type and every leave request, with a details popup. */
function LeavesTab({ staffId, staffName, staffCode }: { staffId: string; staffName: string; staffCode: string }) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [detail, setDetail] = useState<LeaveRequestRow | null>(null);
  const query = useQuery({ queryKey: ['staff-members', 'leaves', staffId], queryFn: () => fetchStaffLeaves(staffId) });

  if (query.isError) {
    return <Alert type="error" showIcon message="Could not load the leaves of this staff member." />;
  }
  if (!query.data) {
    return <Spin />;
  }
  const { balances, requests } = query.data;
  const term = search.trim().toLowerCase();
  const rows = requests.filter(
    (r) => !term || [r.leaveTypeName, leaveRange(r), LEAVE_STATUS_LABEL[r.status], formatDisplayDate(r.applyDate)].some((v) => v.toLowerCase().includes(term)),
  );

  return (
    <div data-testid="staff-leaves">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {balances.map((b) => (
          <Col key={b.leaveTypeId} xs={24} sm={12} xl={6}>
            <StatCard
              label={`${b.name} (${(b.allotted ?? 0).toFixed(2)})`}
              icon={<SendOutlined />}
              hint={
                <>
                  <div>Used: {b.used}</div>
                  <div>Available: {b.available ?? 'No limit'}</div>
                </>
              }
            />
          </Col>
        ))}
      </Row>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input.Search allowClear placeholder="Search" aria-label="Search leaves" style={{ maxWidth: 240 }} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Rows per page" value={pageSize} onChange={setPageSize} options={[10, 25, 50, 100].map((n) => ({ value: n, label: n }))} style={{ width: 80 }} />
      </div>
      <Table<LeaveRequestRow>
        size="small"
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize, hideOnSinglePage: true, showTotal: (total, [from, to]) => `Showing ${from} to ${to} of ${total} entries` }}
        locale={{ emptyText: 'No leave requests.' }}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Leave Type', dataIndex: 'leaveTypeName', sorter: (a, b) => a.leaveTypeName.localeCompare(b.leaveTypeName) },
          { title: 'Leave Date', render: (_, r) => leaveRange(r), sorter: (a, b) => a.fromDate.localeCompare(b.fromDate) },
          { title: 'Days', dataIndex: 'days', align: 'right', render: (v: number) => v.toFixed(2) },
          { title: 'Apply Date', dataIndex: 'applyDate', render: (v: string) => formatDisplayDate(v), sorter: (a, b) => a.applyDate.localeCompare(b.applyDate) },
          { title: 'Status', dataIndex: 'status', render: (v: LeaveStatus) => <Tag color={STATUS_COLOR[v]}>{LEAVE_STATUS_LABEL[v]}</Tag> },
          {
            title: 'Action',
            align: 'right',
            render: (_, r) => <Button size="small" type="primary" icon={<EyeOutlined />} aria-label="View leave details" onClick={() => setDetail(r)} />,
          },
        ]}
      />
      <Modal open={detail !== null} title="Details" footer={null} width={760} onCancel={() => setDetail(null)}>
        {detail && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Name">{staffName}</Descriptions.Item>
            <Descriptions.Item label="Staff ID">{staffCode}</Descriptions.Item>
            <Descriptions.Item label="Leave">
              {leaveRange(detail)} ({detail.days.toFixed(2)} Days{detail.halfDay ? `, ${HALF_DAY_LABEL[detail.halfDay]}` : ''})
            </Descriptions.Item>
            <Descriptions.Item label="Leave Type">{detail.leaveTypeName}</Descriptions.Item>
            <Descriptions.Item label="Status">{LEAVE_STATUS_LABEL[detail.status]}</Descriptions.Item>
            <Descriptions.Item label="Apply Date">{formatDisplayDate(detail.applyDate)}</Descriptions.Item>
            <Descriptions.Item label="Reason">{detail.reason}</Descriptions.Item>
            <Descriptions.Item label="Note">{detail.note}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default LeavesTab;
