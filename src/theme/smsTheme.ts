import { theme, type ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark' | 'system';

export const SMS_COLORS = {
  primary: '#2563EB',
  secondary: '#14B8A6',
  accent: '#F59E0B',
  ink: '#0F172A',
  muted: '#475569',
} as const;

const shared: ThemeConfig['token'] = {
  colorPrimary: SMS_COLORS.primary,
  colorInfo: SMS_COLORS.primary,
  colorSuccess: '#059669',
  colorWarning: SMS_COLORS.accent,
  colorError: '#DC2626',
  colorLink: SMS_COLORS.primary,
  borderRadius: 14,
  borderRadiusLG: 18,
  fontFamily: "'Nunito', 'Inter', system-ui, sans-serif",
  fontSize: 15,
  lineHeight: 1.65,
  controlHeight: 40,
};

export function buildAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...shared,
      colorBgLayout: isDark ? '#0B1220' : '#EEF4FF',
      colorBgContainer: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.78)',
      colorText: isDark ? '#F8FAFC' : SMS_COLORS.ink,
      colorTextSecondary: isDark ? '#CBD5E1' : SMS_COLORS.muted,
      colorTextTertiary: isDark ? '#94A3B8' : '#64748B',
      colorBorderSecondary: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(37, 99, 235, 0.10)',
      boxShadowTertiary: isDark
        ? '0 16px 40px -18px rgba(0, 0, 0, 0.55)'
        : '0 16px 40px -20px rgba(37, 99, 235, 0.28)',
    },
    components: {
      Layout: {
        headerBg: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 255, 255, 0.72)',
        siderBg: isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255, 255, 255, 0.62)',
        bodyBg: 'transparent',
      },
      Menu: {
        itemBg: 'transparent',
        itemColor: isDark ? '#CBD5E1' : '#475569',
        itemHoverBg: isDark ? 'rgba(20, 184, 166, 0.16)' : 'rgba(20, 184, 166, 0.12)',
        itemHoverColor: isDark ? '#F8FAFC' : SMS_COLORS.primary,
        itemSelectedBg: SMS_COLORS.primary,
        itemSelectedColor: '#FFFFFF',
        itemBorderRadius: 12,
        itemMarginInline: 8,
        iconSize: 16,
        subMenuItemBg: 'transparent',
      },
      Card: { borderRadiusLG: 18 },
      Button: { borderRadius: 12, controlHeight: 40, primaryShadow: 'none', fontWeight: 650 },
      Input: { borderRadius: 12, controlHeight: 40 },
      Select: { borderRadius: 12, controlHeight: 40 },
      DatePicker: { borderRadius: 12, controlHeight: 40 },
      Tag: { borderRadiusSM: 999 },
      Table: {
        borderRadiusLG: 16,
        headerBg: isDark ? 'rgba(37, 99, 235, 0.16)' : '#E8F0FE',
        rowHoverBg: isDark ? 'rgba(20, 184, 166, 0.12)' : 'rgba(37, 99, 235, 0.06)',
      },
      Segmented: {
        itemSelectedBg: SMS_COLORS.primary,
        itemSelectedColor: '#fff',
        trackBg: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(37,99,235,0.08)',
      },
    },
  };
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
