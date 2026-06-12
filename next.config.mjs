/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sql.js', 'jsonrepair'],
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
  // API 路由请求体大小限制（默认 1MB，generate 路由使用 4MB 以支持图片输入）
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '4mb',
  },
};

export default nextConfig;
