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
  async function adultRole(){
    const current=await session();
    if(!current?.user?.email)return null;
    const result=await client.from('adult_access').select('role').eq('learner_id',cfg.learnerId).eq('email',current.user.email.toLowerCase()).maybeSingle();
    return result.error?null:(result.data?.role||null);
  }
  async function isAdult(){return !!(await adultRole())}
  async function claimLearner(code){
    await ensureAnonymous();
    const result=await client.rpc('claim_maya_device',{private_code:code});
    if(result.error)throw result.error;
    localStorage.setItem('maya_cloud_learner','1');
    return result.data;
  }
  function normalizedAssignment(row){
    if(!row)return row;
    const subjects=row.subjects||{};
    return {
      ...row,
      subjects,
      multiplication:subjects.multiplication||row.multiplication,
      fractions:subjects.fractions?.lessons||row.fractions||[],
      percentages:subjects.percentages?.lessons||[]
    };
  }
  async function topics(){
    const result=await client.from('maths_topics').select('id,title,module_path,assignment_kind,sort_order,active,lessons').order('sort_order').order('id');
    if(result.error)throw result.error;
    return result.data||[];
  }
  function lessonUrl(topic,lessonId,mode='learner'){
    if(!/^[a-zA-Z0-9_-]+\.html$/.test(topic.module_path))throw new Error('Invalid lesson module path.');
    const query=new URLSearchParams({mode,cloud:'1',lesson:String(lessonId)});
    return topic.module_path+'?'+query.toString();
  }
  async function saveTopicAssignments(changes){
    const result=await client.rpc('save_maths_topic_assignments',{p_learner_id:cfg.learnerId,p_changes:changes});
    if(result.error)throw result.error;
    return normalizedAssignment(Array.isArray(result.data)?result.data[0]:result.data);
  }
  async function saveLessonProgress(subject,lessonId,record){
    const result=await client.rpc('save_maths_lesson_progress',{p_learner_id:cfg.learnerId,p_subject:subject,p_lesson_id:String(lessonId),p_record:record});
    if(result.error)throw result.error;
    return true;
  }

  async function assignment(){
    const result=await client.from('assignments').select('*').eq('learner_id',cfg.learnerId).single();
    if(result.error)throw result.error;
    return normalizedAssignment(result.data);
  }
  async function saveAssignment(multiplication,fractions,percentages){
    const changes={multiplication,fractions:{lessons:fractions}};
    if(percentages!==undefined)changes.percentages={lessons:percentages};
    return saveTopicAssignments(changes);
  }
  async function addAdult(email,role){
    const result=await client.rpc('add_maya_adult',{new_email:email,new_role:role});
    if(result.error)throw result.error;
    return true;
  }
  async function adults(){
    const result=await client.rpc('list_maya_adults');
    if(result.error)throw result.error;
    return result.data||[];
  }
  async function updateAdult(email,role){
    const result=await client.rpc('update_maya_adult',{target_email:email,new_role:role});
    if(result.error)throw result.error;
    return true;
  }
  async function removeAdult(email){
    const result=await client.rpc('remove_maya_adult',{target_email:email});
    if(result.error)throw result.error;
    return true;
  }
  async function beginLearnerSession(pin){
    const result=await client.rpc('begin_maya_session',{session_pin:pin});
    if(result.error)throw result.error;
    return result.data;
  }
  async function learnerSessionStatus(){
    const result=await client.rpc('maya_session_status');
    if(result.error)throw result.error;
    return result.data&&new Date(result.data).getTime()>Date.now()?result.data:null;
  }
  async function endLearnerSession(){
    const result=await client.rpc('end_maya_session');
    if(result.error)throw result.error;
    return true;
  }
  async function setLearnerPin(pin){
    const result=await client.rpc('set_maya_session_pin',{new_pin:pin});
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
  async function recordEvent(subject,eventType,activity,data={}){
    const result=await client.from('learning_events').insert({learner_id:cfg.learnerId,subject,event_type:eventType,activity,data});
    if(result.error)throw result.error;
    return true;
  }
  async function learningEvents(days=14){
    const since=new Date(Date.now()-Math.max(1,days)*86400000).toISOString();
    const result=await client.from('learning_events').select('*').eq('learner_id',cfg.learnerId).gte('occurred_at',since).order('occurred_at',{ascending:false});
    if(result.error)throw result.error;
    return result.data||[];
  }
  window.MayaCloud={client,session,ensureAnonymous,signInAdult,adultRole,isAdult,claimLearner,assignment,saveAssignment,topics,lessonUrl,saveTopicAssignments,saveLessonProgress,addAdult,adults,updateAdult,removeAdult,beginLearnerSession,learnerSessionStatus,endLearnerSession,setLearnerPin,progress,saveProgress,recordEvent,learningEvents,signOut:()=>client.auth.signOut()};
})();
