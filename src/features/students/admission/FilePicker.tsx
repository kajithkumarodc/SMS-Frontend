import { Button, Space, Typography, Upload, theme } from 'antd';
import { CloseOutlined, CloudUploadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { formatFileSize } from '../../../lib/files';

type Props = {
  id?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** e.g. "image/*" for photos. */
  accept?: string;
  /** Returns why a file is refused, or undefined when it's fine. */
  validate?: (file: File) => string | undefined;
  onRejected?: (reason: string) => void;
  ariaLabel: string;
};

/** Smart School's "Drag and drop a file here or click" box, holding one file until the form is saved. */
function FilePicker({ id, value, onChange, accept, validate, onRejected, ariaLabel }: Props) {
  const { token } = theme.useToken();
  if (value) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: token.marginXS,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadius,
          padding: `${token.paddingXXS + 2}px ${token.paddingSM}px`,
          minHeight: 40,
        }}
      >
        <Space size={token.marginXXS} style={{ minWidth: 0 }}>
          <PaperClipOutlined />
          <Typography.Text ellipsis style={{ maxWidth: 200 }} title={value.name}>
            {value.name}
          </Typography.Text>
          <Typography.Text type="secondary">({formatFileSize(value.size)})</Typography.Text>
        </Space>
        <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Remove ${value.name}`} onClick={() => onChange(null)} />
      </div>
    );
  }
  return (
    <>
    <style>{`.compact-dropzone .ant-upload-btn { padding: 0 !important; }`}</style>
    <Upload.Dragger
      className="compact-dropzone"
      id={id}
      accept={accept}
      multiple={false}
      showUploadList={false}
      beforeUpload={(file) => {
        const problem = validate?.(file);
        if (problem) onRejected?.(problem);
        else onChange(file);
        return false;
      }}
      style={{ padding: 0 }}
      aria-label={ariaLabel}
    >
      <div
        style={{
          padding: `${token.paddingXXS + 2}px ${token.paddingSM}px`,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <CloudUploadOutlined style={{ marginInlineEnd: token.marginXS }} />
        Drag and drop a file here or click
      </div>
    </Upload.Dragger>
    </>
  );
}

export default FilePicker;
