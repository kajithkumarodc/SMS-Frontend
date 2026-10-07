import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, List, Result, Row, Skeleton, Space, Statistic, Tag, Typography, theme } from 'antd';
import { ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchEnquirySummary, type EnquiryGroupCount } from '../../api/enquiries';
import { useAuthStore } from '../../store/authStore';
import { hasPermission } from '../../lib/roles';
import { ENQUIRY_SUMMARY_KEY } from './queryKeys';
import { ENQUIRY_STATUS_COLOR, enquiryStatusLabel } from './status';

const { Title, Text } = Typography;

/** A source/class breakdown row -- clickable (with an arrow affordance) when it has a real id, plain text for "Not specified". */
function GroupCountRow({ row, onClick }: { row: EnquiryGroupCount; onClick: (row: EnquiryGroupCount) => void }) {
  const { token } = theme.useToken();
  if (row.id === null) {
    return (
      <List.Item extra={<Text type="secondary">{row.count}</Text>}>
        <Text type="secondary">{row.label}</Text>
      </List.Item>
    );
  }
  return (
    <List.Item style={{ cursor: 'pointer' }} onClick={() => onClick(row)}>
      <a style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: token.marginXS }}>
        <span>{row.label}</span>
        <Space size={token.marginXS}>
          <Text strong>{row.count}</Text>
          <ArrowRightOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
        </Space>
      </a>
    </List.Item>
  );
}

function FrontOfficePage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const canView = hasPermission(permissions, 'ENQUIRY_VIEW');

  const summaryQuery = useQuery({ queryKey: ENQUIRY_SUMMARY_KEY, queryFn: fetchEnquirySummary, enabled: canView });

  if (!canView) {
    return <Result status="403" title="Not available" subTitle="You don't have permission to view Front Office." />;
  }

  const summary = summaryQuery.data;

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto' }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          marginBottom: token.marginLG,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Front Office
          </Title>
          <Text type="secondary">Admission enquiry pipeline, at a glance.</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void summaryQuery.refetch()}
          loading={summaryQuery.isFetching && !summaryQuery.isPending}
        >
          Refresh
        </Button>
      </header>

      {summaryQuery.isError ? (
        <Alert
          type="warning"
          showIcon
          message="Couldn't load the Front Office overview"
          description="There was a problem reaching the server."
          action={
            <Button size="small" onClick={() => void summaryQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : summaryQuery.isPending ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: token.marginLG }}>
            <Col xs={12} sm={8} md={4}>
              <Card size="small" style={{ boxShadow: token.boxShadowTertiary }}>
                <Statistic title="Total enquiries" value={summary!.totalEnquiries} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card size="small" style={{ boxShadow: token.boxShadowTertiary }}>
                <Statistic title="Active" value={summary!.activeEnquiries} valueStyle={{ color: token.colorPrimary }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card size="small" style={{ boxShadow: token.boxShadowTertiary }}>
                <Statistic
                  title="Follow-ups due"
                  value={summary!.followUpsDue}
                  valueStyle={{ color: token.colorWarning }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card size="small" style={{ boxShadow: token.boxShadowTertiary }}>
                <Statistic title="Converted" value={summary!.converted} valueStyle={{ color: token.colorSuccess }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card size="small" style={{ boxShadow: token.boxShadowTertiary }}>
                <Statistic title="Lost" value={summary!.lost} valueStyle={{ color: token.colorError }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={4}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate('/app/front-office/admission-enquiry')}
                style={{ boxShadow: token.boxShadowTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Button type="link" icon={<ArrowRightOutlined />} iconPosition="end">
                  View all enquiries
                </Button>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: token.marginLG }}>
            <Col xs={24} md={12}>
              <Card
                title="Enquiries by source"
                size="small"
                style={{ boxShadow: token.boxShadowTertiary }}
                extra={
                  summary!.academicYear && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {summary!.academicYear.name}
                    </Text>
                  )
                }
              >
                {summary!.bySource.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data yet" />
                ) : (
                  <List
                    size="small"
                    dataSource={summary!.bySource}
                    renderItem={(row) => (
                      <GroupCountRow row={row} onClick={(r) => navigate(`/app/front-office/admission-enquiry?sourceId=${r.id}`)} />
                    )}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title="Enquiries by class"
                size="small"
                style={{ boxShadow: token.boxShadowTertiary }}
                extra={
                  summary!.academicYear && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {summary!.academicYear.name}
                    </Text>
                  )
                }
              >
                {summary!.byClass.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data yet" />
                ) : (
                  <List
                    size="small"
                    dataSource={summary!.byClass}
                    renderItem={(row) => (
                      <GroupCountRow row={row} onClick={(r) => navigate(`/app/front-office/admission-enquiry?classId=${r.id}`)} />
                    )}
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Recent enquiries" size="small" style={{ boxShadow: token.boxShadowTertiary }}>
            {summary!.recent.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No enquiries yet" />
            ) : (
              <List
                size="small"
                dataSource={summary!.recent}
                renderItem={(item) => (
                  <List.Item
                    extra={<Tag color={ENQUIRY_STATUS_COLOR[item.status]}>{enquiryStatusLabel(item.status)}</Tag>}
                  >
                    <List.Item.Meta
                      title={
                        <a onClick={() => navigate('/app/front-office/admission-enquiry')}>
                          {item.applicantName} · {item.enquiryNumber}
                        </a>
                      }
                      description={item.sourceName ?? 'Not specified'}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default FrontOfficePage;
