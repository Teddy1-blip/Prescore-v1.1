import type {NextConfig} from 'next';
// Next checks the browser origin for its development-only resources, including HMR.
// Trust the single private port configured by the Codespaces launcher.
const forwardedHost = process.env.CODESPACES === 'true' && process.env.NODE_ENV === 'development'
  ? process.env.PRESCORE_BASE_URL?.match(/^https:\/\/([a-z0-9-]+-\d{1,5}\.app\.github\.dev)$/)?.[1]
  : undefined;
const nextConfig:NextConfig={...(forwardedHost && {allowedDevOrigins:[forwardedHost]}),output:'standalone',poweredByHeader:false,
 serverExternalPackages:['pdfjs-dist','@napi-rs/canvas'],
 outputFileTracingIncludes:{'/api/ready':['./lib/db/migrations/*.sql'],'/dashboard/report-v2':['./tests/fixtures/credit-lab/development-v1/business-sources.zip'],'/api/source-documents':['./node_modules/pdfjs-dist/legacy/build/**','./node_modules/@napi-rs/canvas/**','./node_modules/@napi-rs/canvas-linux-x64-gnu/**']}};
export default nextConfig;
