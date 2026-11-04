import {packagedProvenance as p} from './build-provenance.ts';
export const PRESCORE_RELEASE_ID='PRESCORE-V1-RC3-20261019';
export function runtimeVersion(env:Record<string,string|undefined>=process.env){
 void env; // Retained call signature; runtime variables are not artifact provenance.
 return {application:'prescore-rc1',version:'1.0.0-rc.1',releaseId:PRESCORE_RELEASE_ID,sourceSha:p?.checkout.commit??'UNKNOWN',sourceTree:p?.checkout.tree??'UNKNOWN',buildTimestamp:p?.packagedAt??'UNKNOWN',schemaVersion:'0010_admin_mfa.sql',billingContractVersion:'BILLING_V1',publicReportContractVersion:'PRESCORE-CLIENT-REPORT-1.0.0-SHADOW',buildProvenance:p?{version:p.version,status:'PACKAGED_INPUT_FINGERPRINT',sourceIdentity:'BUILD_CHECKOUT',checkoutStatus:p.checkout.status,scope:p.inputs.scope,sourceFingerprint:p.inputs.sha256,lockSha256:p.inputs.lockSha256,fileCount:p.inputs.fileCount,buildId:p.buildId,publishedImageDigest:null,runningImageDigest:null}:{status:'UNAVAILABLE',publishedImageDigest:null,runningImageDigest:null}};
}
