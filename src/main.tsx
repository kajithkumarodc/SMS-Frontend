import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import App from './App';
import './index.css';
import { queryClient } from './lib/queryClient';
import { installMagneticGlow } from './lib/magneticGlow';

installMagneticGlow();

// "Magnetic Modern UI" -- aqua glass: airy pale-blue surfaces, deep navy anchors, teal/cyan highlights.
const NAVY = '#17376B';
const INK = '#0F2547';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: NAVY,
            colorInfo: '#0EA5C6',
            colorSuccess: '#10B981',
            colorWarning: '#F59E0B',
            colorError: '#EF4444',
            colorLink: '#1D6FD1',
            colorBgLayout: '#E8F0F9',
            colorBgContainer: '#FFFFFF',
            colorText: INK,
            colorTextSecondary: '#5B6F8F',
            colorTextTertiary: '#8A9BB5',
            colorBorderSecondary: 'rgba(23, 55, 107, 0.08)',
            borderRadius: 14,
            borderRadiusLG: 22,
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadowTertiary: '0 12px 32px -16px rgba(23, 55, 107, 0.25)',
          },
          components: {
            Layout: { headerBg: 'rgba(255, 255, 255, 0.6)', siderBg: 'rgba(255, 255, 255, 0.55)', bodyBg: 'transparent' },
            Menu: {
              itemBg: 'transparent',
              itemColor: '#5B6F8F',
              itemHoverBg: 'rgba(14, 165, 198, 0.12)',
              itemHoverColor: NAVY,
              itemSelectedBg: NAVY,
              itemSelectedColor: '#FFFFFF',
              itemBorderRadius: 999,
              itemMarginInline: 8,
              iconSize: 16,
              subMenuItemBg: 'transparent',
            },
            Card: { borderRadiusLG: 22, headerBg: 'transparent' },
            Button: { borderRadius: 999, controlHeight: 38, primaryShadow: 'none' },
            Input: { borderRadius: 12, controlHeight: 38 },
            Tag: { borderRadiusSM: 999 },
            Table: { borderRadiusLG: 18, headerBg: '#EEF4FB', rowHoverBg: 'rgba(14, 165, 198, 0.07)' },
            Segmented: { itemSelectedBg: NAVY, itemSelectedColor: '#fff', trackBg: 'rgba(23,55,107,0.07)' },
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
