import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider } from 'antd';
import App from './App';
import './index.css';
import { queryClient } from './lib/queryClient';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#8A63F2',
            colorInfo: '#8A63F2',
            colorLink: '#8A63F2',
            colorBgLayout: '#EEF0FB',
            colorBgContainer: '#FFFFFF',
            borderRadius: 14,
            borderRadiusLG: 18,
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadowTertiary:
              '0 2px 8px 0 rgba(102, 90, 190, 0.06), 0 1px 2px 0 rgba(102, 90, 190, 0.08)',
          },
          components: {
            Layout: {
              headerBg: '#FFFFFF',
              siderBg: '#FFFFFF',
              bodyBg: '#F7F7FC',
            },
            Menu: {
              itemBg: 'transparent',
              itemColor: '#6B7280',
              itemHoverBg: '#F3F1FE',
              itemHoverColor: '#8A63F2',
              itemSelectedBg: '#8A63F2',
              itemSelectedColor: '#FFFFFF',
              itemBorderRadius: 12,
              itemMarginInline: 8,
              iconSize: 16,
            },
            Card: {
              borderRadiusLG: 18,
              boxShadowTertiary:
                '0 2px 8px 0 rgba(102, 90, 190, 0.06), 0 1px 2px 0 rgba(102, 90, 190, 0.08)',
            },
            Button: {
              borderRadius: 10,
              controlHeight: 38,
            },
            Input: {
              borderRadius: 10,
              controlHeight: 38,
            },
            Tag: {
              borderRadiusSM: 8,
            },
            Table: {
              borderRadiusLG: 16,
              headerBg: '#F7F7FC',
            },
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
