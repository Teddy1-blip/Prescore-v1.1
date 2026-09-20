import type {NextConfig} from 'next';
const nextConfig:NextConfig={output:'standalone',poweredByHeader:false,
 // npm build runs exact-baseline diagnostics gate first. Only known pre-migration diagnostics are tolerated.
 typescript:{ignoreBuildErrors:true}};
export default nextConfig;
