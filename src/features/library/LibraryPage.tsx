import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Result,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchBooks, type LibraryBook } from '../../api/library';
import { useAuthStore } from '../../store/authStore';
import { hasAnyRole, hasRole, ROLE } from '../../lib/roles';
import { LIBRARY_BOOKS_KEY } from './queryKeys';
import AddBookModal from './AddBookModal';
import IssueBookModal from './IssueBookModal';
import ActiveLoansCard from './ActiveLoansCard';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

function LibraryPage() {
  const { token } = theme.useToken();
  const roles = useAuthStore((state) => state.user?.roles);
  const canView = hasAnyRole(roles, [ROLE.SCHOOL_ADMIN, ROLE.TEACHER]);
  const canManage = hasRole(roles, ROLE.SCHOOL_ADMIN);

  const [page, setPage] = useState(1); // 1-based for the Table; the API is 0-based
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState(''); // committed query sent to the server
  const [addOpen, setAddOpen] = useState(false);
  const [issuing, setIssuing] = useState<LibraryBook | null>(null);

  const booksQuery = useQuery({
    queryKey: [...LIBRARY_BOOKS_KEY, { page, pageSize, q: search }],
    queryFn: () => fetchBooks({ page: page - 1, size: pageSize, q: search }),
    enabled: canView,
    placeholderData: keepPreviousData,
  });

  if (!canView) {
    return (
      <Result
        status="403"
        title="Not available"
        subTitle="Only school staff can view the library."
      />
    );
  }

  const books = booksQuery.data?.content ?? [];
  const total = booksQuery.data?.page.totalElements ?? 0;

  const columns: ColumnsType<LibraryBook> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
    },
    {
      title: 'ISBN',
      dataIndex: 'isbn',
      key: 'isbn',
      width: 180,
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Copies',
      key: 'copies',
      width: 130,
      align: 'right',
      render: (_value, record) => {
        const out = record.availableCopies === 0;
        return (
          <Tag color={out ? 'default' : 'success'} style={{ marginInlineEnd: 0 }}>
            {record.availableCopies} / {record.totalCopies}
          </Tag>
        );
      },
    },
  ];

  if (canManage) {
    columns.push({
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_value, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => setIssuing(record)}
          disabled={record.availableCopies === 0}
          style={{ paddingInline: 0 }}
        >
          Issue book
        </Button>
      ),
    });
  }

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
            Library
          </Title>
          <Text type="secondary">The book catalogue and what&rsquo;s currently on loan.</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void booksQuery.refetch()}
            loading={booksQuery.isFetching && !booksQuery.isPending}
          >
            Refresh
          </Button>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Add book
            </Button>
          )}
        </Space>
      </header>

      <Card
        title="Catalogue"
        style={{ marginBottom: token.marginLG, boxShadow: token.boxShadowTertiary }}
        styles={{ body: { padding: token.paddingLG } }}
        extra={
          <Input.Search
            data-testid="library-search"
            allowClear
            placeholder="Search title or author"
            defaultValue={search}
            onSearch={(value) => {
              setSearch(value.trim());
              setPage(1);
            }}
            style={{ width: 240, maxWidth: '100%' }}
          />
        }
      >
        {booksQuery.isError ? (
          <Alert
            type="warning"
            showIcon
            message="Couldn't load the catalogue"
            description="There was a problem reaching the server."
            action={
              <Button size="small" onClick={() => void booksQuery.refetch()}>
                Try again
              </Button>
            }
          />
        ) : booksQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Table<LibraryBook>
            rowKey="id"
            columns={columns}
            dataSource={books}
            loading={booksQuery.isFetching}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={search ? 'No books match your search' : 'No books in the catalogue yet'}
                />
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (count) => `${count} book${count === 1 ? '' : 's'}`,
              onChange: (nextPage, nextSize) => {
                setPage(nextSize === pageSize ? nextPage : 1);
                setPageSize(nextSize);
              },
            }}
          />
        )}
      </Card>

      <ActiveLoansCard canReturn={canManage} />

      {canManage && (
        <>
          <AddBookModal open={addOpen} onClose={() => setAddOpen(false)} />
          <IssueBookModal book={issuing} onClose={() => setIssuing(null)} />
        </>
      )}
    </div>
  );
}

export default LibraryPage;
