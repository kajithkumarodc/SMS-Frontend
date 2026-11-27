import { Segmented } from 'antd';
import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import type { ThemeMode } from './smsTheme';
import { useThemeMode } from './ThemeProvider';

function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  return (
    <Segmented
      aria-label="Color theme"
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
      options={[
        { value: 'light', icon: <SunOutlined />, title: 'Light theme' },
        { value: 'dark', icon: <MoonOutlined />, title: 'Dark theme' },
        { value: 'system', icon: <DesktopOutlined />, title: 'Match system theme' },
      ]}
    />
  );
}

export default ThemeToggle;
