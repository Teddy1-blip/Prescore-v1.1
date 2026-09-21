import type {NextConfig} from 'next';
const nextConfig:NextConfig={output:'standalone',poweredByHeader:false,
 outputFileTracingIncludes:{'/dashboard/report-v2':['./tests/fixtures/credit-lab/development-v1/business-sources.zip']},
 // npm build runs exact-baseline diagnostics gate first. Only known pre-migration diagnostics are tolerated.
 typescript:{ignoreBuildErrors:true}};
export default nextConfig;
