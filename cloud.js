(function(){
  const cfg=window.MAYA_CLOUD_CONFIG;
  if(!cfg||!window.supabase){console.error('Maya Cloud configuration is unavailable.');return}
  const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  async function session(){return (await client.auth.getSession()).data.session}
  async function ensureAnonymous(){
    let current=await session();
    if(current)return current;
    const result=await client.auth.signInAnonymously();
    if(result.error)throw result.error;
    return result.data.session;
  }
  async function signInAdult(email,redirectTo){
    const result=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo||location.href,shouldCreateUser:true}});
    if(result.error)throw result.error;
    return true;
  }
  async function isAdult(){
    const current=await session();
    if(!current?.user?.email)return false;
    const result=await client.from('adult_access').select('role').eq('learner_id',cfg.learnerId).maybeSingle();
    return !result.error&&!!result.data;
  }
  async function claimLearner(code){
    await ensureAnonymous();
    const result=await client.rpc('claim_maya_device',{private_code:code});
    if(result.error)throw result.error;
    localStorage.setItem('maya_cloud_learner','1');
    return result.data;
  }
  async function assignment(){
    const result=await client.from('assignments').select('*').eq('learner_id',cfg.learnerId).single();
    if(result.error)throw result.error;
    return result.data;
  }
  async function saveAssignment(multiplication,fractions){
    const current=await session();
    const result=await client.from('assignments').upsert({learner_id:cfg.learnerId,multiplication,fractions,updated_by:current?.user?.id||null,updated_at:new Date().toISOString()},{onConflict:'learner_id'}).select().single();
    if(result.error)throw result.error;
    return result.data;
  }
  async function addAdult(email,role){
    const result=await client.rpc('add_maya_adult',{new_email:email,new_role:role});
    if(result.error)throw result.error;
    return true;
  }
  async function progress(subject){
    const result=await client.from('progress').select('data,updated_at').eq('learner_id',cfg.learnerId).eq('subject',subject).maybeSingle();
    if(result.error)throw result.error;
    return result.data;
  }
  async function saveProgress(subject,data){
    const result=await client.from('progress').upsert({learner_id:cfg.learnerId,subject,data,updated_at:new Date().toISOString()},{onConflict:'learner_id,subject'});
    if(result.error)throw result.error;
    return true;
  }
  window.MayaCloud={client,session,ensureAnonymous,signInAdult,isAdult,claimLearner,assignment,saveAssignment,addAdult,progress,saveProgress,signOut:()=>client.auth.signOut()};
})();
