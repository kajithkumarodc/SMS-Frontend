import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var _b;
    var mode = _a.mode;
    var env = loadEnv(mode, '.', '');
    var apiBase = env.VITE_API_BASE_URL || '/api';
    var proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8081';
    return {
        plugins: [react()],
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy: (_b = {},
                _b[apiBase] = {
                    target: proxyTarget,
                    changeOrigin: true,
                },
                _b),
        },
        preview: {
            host: '0.0.0.0',
            port: 4173,
        },
    };
});
