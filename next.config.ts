import type {NextConfig} from 'next';
const nextConfig:NextConfig={output:'standalone',poweredByHeader:false,
 serverExternalPackages:['pdfjs-dist','@napi-rs/canvas'],
 outputFileTracingIncludes:{'/dashboard/report-v2':['./tests/fixtures/credit-lab/development-v1/business-sources.zip'],'/api/source-documents':['./node_modules/pdfjs-dist/legacy/build/**','./node_modules/@napi-rs/canvas/**','./node_modules/@napi-rs/canvas-linux-x64-gnu/**']},
 // npm build runs exact-baseline diagnostics gate first. Only known pre-migration diagnostics are tolerated.
 typescript:{ignoreBuildErrors:true}};
export default nextConfig;
