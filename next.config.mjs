/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sql.js'],
  devIndicators: {
    appIsrStatus: false,
    buildActivity: false,
  },
};

export default nextConfig;
