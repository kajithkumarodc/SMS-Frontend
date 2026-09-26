import { Button, Checkbox, Dropdown, Input, Select, Space, Tooltip, theme } from 'antd';
import {
  CopyOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InsertRowRightOutlined,
  PrinterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ExportKind } from '../lib/tableExport';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type ToggleableColumn = { key: string; title: string };

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Accessible name for the search box -- distinct from the app header's global search. */
  searchLabel?: string;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  columns: ToggleableColumn[];
  hiddenColumns: string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  onExport: (kind: ExportKind) => void;
  /** Which export is running, if any -- that button shows a spinner and the others are disabled. */
  exporting: ExportKind | null;
  canExport: boolean;
  canPrint: boolean;
  /** Which export buttons to offer (default: all). */
  exportKinds?: ExportKind[];
  /** Show the show/hide-columns menu (default true). */
  showColumnToggle?: boolean;
};

/** Search box, page size, export buttons and a show/hide-columns menu for list pages. */
function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  searchLabel = 'Search this list',
  pageSize,
  onPageSizeChange,
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
  onExport,
  exporting,
  canExport,
  canPrint,
  exportKinds = ['copy', 'excel', 'csv', 'pdf', 'print'],
  showColumnToggle = true,
}: Props) {
  const { token } = theme.useToken();

  const exportButton = (kind: ExportKind, label: string, icon: React.ReactNode) => (
    <Tooltip title={label} key={kind}>
      <Button
        type="text"
        aria-label={label}
        icon={icon}
        loading={exporting === kind}
        disabled={exporting !== null && exporting !== kind}
        onClick={() => onExport(kind)}
      />
    </Tooltip>
  );

  const toggleColumn = (key: string, visible: boolean) => {
    onHiddenColumnsChange(visible ? hiddenColumns.filter((k) => k !== key) : [...hiddenColumns, key]);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        marginBottom: token.marginMD,
      }}
    >
      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ maxWidth: 260 }}
        aria-label={searchLabel}
      />
      <Space size="small" wrap>
        <Select
          aria-label="Rows per page"
          value={pageSize}
          onChange={onPageSizeChange}
          options={PAGE_SIZE_OPTIONS.map((n) => ({ value: n, label: n }))}
          style={{ width: 80 }}
        />
        <Space size={0}>
          {canExport && exportKinds.includes('copy') && exportButton('copy', 'Copy', <CopyOutlined />)}
          {canExport && exportKinds.includes('excel') && exportButton('excel', 'Excel', <FileExcelOutlined />)}
          {canExport && exportKinds.includes('csv') && exportButton('csv', 'CSV', <FileTextOutlined />)}
          {canExport && exportKinds.includes('pdf') && exportButton('pdf', 'PDF', <FilePdfOutlined />)}
          {canPrint && exportKinds.includes('print') && exportButton('print', 'Print', <PrinterOutlined />)}
          {showColumnToggle && (
          <Dropdown
            trigger={['click']}
            popupRender={() => (
              <div
                style={{
                  background: token.colorBgElevated,
                  borderRadius: token.borderRadiusLG,
                  boxShadow: token.boxShadowSecondary,
                  padding: token.paddingSM,
                }}
              >
                <Space direction="vertical" size={token.marginXXS}>
                  {columns.map((column) => (
                    <Checkbox
                      key={column.key}
                      checked={!hiddenColumns.includes(column.key)}
                      onChange={(e) => toggleColumn(column.key, e.target.checked)}
                    >
                      {column.title}
                    </Checkbox>
                  ))}
                </Space>
              </div>
            )}
          >
            <Tooltip title="Columns">
              <Button type="text" aria-label="Show or hide columns" icon={<InsertRowRightOutlined />} />
            </Tooltip>
          </Dropdown>
          )}
        </Space>
      </Space>
    </div>
  );
}

export default DataTableToolbar;
