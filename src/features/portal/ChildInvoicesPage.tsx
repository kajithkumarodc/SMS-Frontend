import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Skeleton, Typography, theme } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { ChildNotFoundError, fetchChildInvoices, fetchMyChildren } from '../../api/portal';
import { useAuthStore } from '../../store/authStore';
import { hasRole, ROLE } from '../../lib/roles';
import { CHILD_INVOICES_KEY, MY_CHILDREN_KEY } from './queryKeys';
import InvoicesList from '../fees/InvoicesList';

const { Title, Text } = Typography;

function ChildInvoicesPage() {
  const { token } = theme.useToken();
  const { studentId = '' } = useParams();
  const roles = useAuthStore((state) => state.user?.roles);
  const isParent = hasRole(roles, ROLE.PARENT);

  const childrenQuery = useQuery({
    queryKey: MY_CHILDREN_KEY,
    queryFn: fetchMyChildren,
    enabled: isParent,
  });
  const child = childrenQuery.data?.find((c) => c.id === studentId);

  // The endpoint itself enforces ownership (404 -> ChildNotFoundError); the children
  // list is only used for the child's name and a friendly "not yours" screen.
  const invoicesQuery = useQuery({
    queryKey: [...CHILD_INVOICES_KEY, studentId],
    queryFn: () => fetchChildInvoices(studentId),
    enabled: isParent && studentId !== '',
    retry: (failureCount, err) => !(err instanceof ChildNotFoundError) && failureCount < 1,
  });

  if (!isParent) {
    return <Result status="403" title="Not available" subTitle="Only a parent account can view this page." />;
  }

  const notYours =
    (invoicesQuery.isError && invoicesQuery.error instanceof ChildNotFoundError) ||
    (childrenQuery.isSuccess && !child);

  return (
    <div style={{ maxWidth: 720, width: '100%', margin: '0 auto' }}>
      <Link to="/app/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeftOutlined /> Back to dashboard
      </Link>

      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: token.marginSM,
          margin: `${token.marginSM}px 0 ${token.marginLG}px`,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {child ? `${child.fullName} — invoices` : 'Invoices'}
          </Title>
          <Text type="secondary">
            {child?.admissionNumber ? `Admission ${child.admissionNumber}` : 'Fee dues and payments'}
          </Text>
        </div>
        {!notYours && (
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void invoicesQuery.refetch()}
            loading={invoicesQuery.isFetching && !invoicesQuery.isPending}
          >
            Refresh
          </Button>
        )}
      </header>

      {notYours ? (
        <Result
          status="404"
          title="Student not found"
          subTitle="This student isn't linked to your account."
          extra={
            <Link to="/app/dashboard">
              <Button type="primary">Back to dashboard</Button>
            </Link>
          }
        />
      ) : (
        <Card styles={{ body: { padding: token.paddingLG } }} style={{ boxShadow: token.boxShadowTertiary }}>
          {invoicesQuery.isError || childrenQuery.isError ? (
            <Alert
              type="warning"
              showIcon
              message="Couldn't load invoices"
              description="There was a problem reaching the server."
              action={
                <Button size="small" onClick={() => void invoicesQuery.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : childrenQuery.isPending || invoicesQuery.isPending ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : (
            <InvoicesList
              invoices={invoicesQuery.data ?? []}
              onInvoicePaid={() => void invoicesQuery.refetch()}
            />
          )}
        </Card>
      )}
    </div>
  );
}

export default ChildInvoicesPage;
