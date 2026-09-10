import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Result,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import {
  fetchRoutes,
  fetchVehicles,
  type TransportRoute,
  type TransportVehicle,
} from '../../api/transport';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, hasRole, ROLE } from '../../lib/roles';
import { TRANSPORT_ROUTES_KEY, TRANSPORT_VEHICLES_KEY } from './queryKeys';
import AddRouteModal from './AddRouteModal';
import AddVehicleModal from './AddVehicleModal';
import RouteStudentsModal from './RouteStudentsModal';

const { Title, Text } = Typography;

const ALL_ROUTES = '__all__';
const UNASSIGNED = '__unassigned__';

function TransportPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [routeFilter, setRouteFilter] = useState<string>(ALL_ROUTES);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [viewingRoute, setViewingRoute] = useState<TransportRoute | null>(null);

  const routesQuery = useQuery({
    queryKey: TRANSPORT_ROUTES_KEY,
    queryFn: fetchRoutes,
    enabled: canView,
  });

  // The vehicles endpoint filters by a real route id only; "all" and "unassigned"
  // are resolved client-side from the full list.
  const vehiclesQuery = useQuery({
    queryKey: [...TRANSPORT_VEHICLES_KEY, { routeId: ALL_ROUTES }],
    queryFn: () => fetchVehicles(),
    enabled: canView,
  });

  const routeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of routesQuery.data ?? []) map.set(r.id, r.name);
    return (id: string | null) => (id ? map.get(id) ?? 'Unknown route' : null);
  }, [routesQuery.data]);

  if (!canView) {
    return (
      <Result status="403" title="Not available" subTitle="Only school staff can view transport." />
    );
  }

  const routes = routesQuery.data ?? [];
  const allVehicles = vehiclesQuery.data ?? [];
  const vehicles =
    routeFilter === ALL_ROUTES
      ? allVehicles
      : routeFilter === UNASSIGNED
        ? allVehicles.filter((v) => v.routeId === null)
        : allVehicles.filter((v) => v.routeId === routeFilter);

  const vehicleColumns: ColumnsType<TransportVehicle> = [
    {
      title: 'Registration',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Driver',
      key: 'driver',
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.driverName}</Text>
          {record.driverContact ? (
            <Text type="secondary">{record.driverContact}</Text>
          ) : (
            <Text type="secondary">No contact</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 110,
      align: 'right',
      render: (value: number) => `${value} seats`,
    },
    {
      title: 'Route',
      dataIndex: 'routeId',
      key: 'routeId',
      render: (routeId: string | null) => {
        const name = routeName(routeId);
        return name ? (
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {name}
          </Tag>
        ) : (
          <Text type="secondary">Unassigned</Text>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1040, width: '100%', margin: '0 auto' }}>
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
            Transport
          </Title>
          <Text type="secondary">Routes, vehicles and who rides them.</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            void routesQuery.refetch();
            void vehiclesQuery.refetch();
          }}
          loading={
            (routesQuery.isFetching && !routesQuery.isPending) ||
            (vehiclesQuery.isFetching && !vehiclesQuery.isPending)
          }
        >
          Refresh
        </Button>
      </header>

      <Card
        title="Routes"
        style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
        extra={
          canManage && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddRouteOpen(true)}>
              Add route
            </Button>
          )
        }
      >
        {routesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load routes"
            action={
              <Button size="small" onClick={() => void routesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : routesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : routes.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No routes yet" />
        ) : (
          <Row gutter={[token.margin, token.margin]}>
            {routes.map((route) => {
              const count = allVehicles.filter((v) => v.routeId === route.id).length;
              return (
                <Col key={route.id} xs={24} sm={12} lg={8}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => setViewingRoute(route)}
                    style={{ height: '100%', boxShadow: token.boxShadowTertiary }}
                  >
                    <Space direction="vertical" size={token.marginXXS} style={{ width: '100%' }}>
                      <Text strong>{route.name}</Text>
                      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                        {count} vehicle{count === 1 ? '' : 's'}
                      </Text>
                      <Text style={{ color: token.colorPrimary, fontSize: token.fontSizeSM }}>
                        View students <RightOutlined />
                      </Text>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      <Card
        title="Vehicles"
        style={{ boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
        extra={
          <Space wrap>
            <Select
              data-testid="vehicle-route-filter"
              value={routeFilter}
              onChange={setRouteFilter}
              style={{ width: 200 }}
              options={[
                { value: ALL_ROUTES, label: 'All routes' },
                { value: UNASSIGNED, label: 'Unassigned' },
                ...routes.map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
            {canManage && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setAddVehicleOpen(true)}
              >
                Add vehicle
              </Button>
            )}
          </Space>
        }
      >
        {vehiclesQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load vehicles"
            action={
              <Button size="small" onClick={() => void vehiclesQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : vehiclesQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Table<TransportVehicle>
            rowKey="id"
            columns={vehicleColumns}
            dataSource={vehicles}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={routeFilter === ALL_ROUTES ? 'No vehicles yet' : 'No vehicles for this filter'}
                />
              ),
            }}
          />
        )}
      </Card>

      {canManage && (
        <>
          <AddRouteModal open={addRouteOpen} onClose={() => setAddRouteOpen(false)} />
          <AddVehicleModal open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
        </>
      )}
      <RouteStudentsModal route={viewingRoute} onClose={() => setViewingRoute(null)} />
    </div>
  );
}

export default TransportPage;
