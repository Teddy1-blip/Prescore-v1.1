export async function register(){
  if(process.env.NEXT_RUNTIME!=='nodejs')return;
  const {purgeOldStagingHistory}=await import('./lib/staging-history-purge');
  const result=await purgeOldStagingHistory();
  console.log('STAGING_HISTORY_PURGE:'+result.status);
}
