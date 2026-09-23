import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const {Pool}=pg;
const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
const JWT_SECRET=process.env.JWT_SECRET;if(!JWT_SECRET)throw new Error('JWT_SECRET is required');
app.set('trust proxy', 1);
app.use(express.json({limit:'50mb'}));app.use(cookieParser());

function sign(u){return jwt.sign({sub:u.id},JWT_SECRET,{expiresIn:'30d'})}
const COOKIE_OPTS={httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*24*60*60*1000,path:'/'};
function setAuth(res,u){const token=sign(u);res.cookie('dhyeya_session',token,COOKIE_OPTS);res.cookie('bpn_session',token,COOKIE_OPTS)}
function clearAuth(res){for(const name of ['dhyeya_session','bpn_session'])res.clearCookie(name,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'})}
function publicUser(u){return {id:u.id,student_code:u.student_code,email:u.email,name:u.name,username:u.username,avatar_url:u.avatar_url,role:u.role,status:u.status,target_exam:u.target_exam,exam_date:u.exam_date,daily_target:u.daily_target,xp:u.xp,level:u.level,streak_days:u.streak_days,last_activity_date:u.last_activity_date,last_login_at:u.last_login_at,preferences:u.preferences,bio:u.bio,target_attempt:u.target_attempt,language:u.language,notification_preferences:u.notification_preferences,created_at:u.created_at}}
async function auth(req,res,next){try{const t=req.cookies.dhyeya_session||req.cookies.bpn_session;if(!t)return res.status(401).json({error:'Authentication required'});const d=jwt.verify(t,JWT_SECRET);const q=await pool.query('SELECT * FROM users WHERE id=$1',[d.sub]);const u=q.rows[0];if(!u)return res.status(401).json({error:'Session expired'});if(u.status!=='active')return res.status(403).json({error:'Account is '+u.status});req.user=u; const ignored=['/auth/me','/presence/heartbeat','/notifications']; if(!ignored.includes(req.path))audit(req.user,`activity:${req.method} ${req.path}`,req.user.id,{ip:req.ip,user_agent:req.get('user-agent')||null}); next()}catch{return res.status(401).json({error:'Invalid session'})}}
function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Admin access required'});next()}
function auditActivity(req,res,next){if(req.user&&req.method!=='GET'&&req.path!=='/auth/logout'&&req.path!=='/auth/change-password')audit(req.user,`activity:${req.method} ${req.path}`,req.user.id,{});next()}
async function hasValidSession(req){try{const t=req.cookies.dhyeya_session||req.cookies.bpn_session;if(!t)return false;const d=jwt.verify(t,JWT_SECRET);const q=await pool.query('SELECT status FROM users WHERE id=$1',[d.sub]);return q.rows[0]?.status==='active'}catch{return false}}
app.get('/',async(req,res)=>{
  try{
    const t=req.cookies.dhyeya_session||req.cookies.bpn_session;
    if(!t)return res.sendFile(path.join(__dirname,'public','login.html'));
    const d=jwt.verify(t,JWT_SECRET);
    const q=await pool.query('SELECT role,status FROM users WHERE id=$1',[d.sub]);
    const u=q.rows[0];
    if(!u||u.status!=='active'){clearAuth(res);return res.sendFile(path.join(__dirname,'public','login.html'));}
    res.set('Cache-Control','no-store');
    return res.sendFile(path.join(__dirname,'public',u.role==='admin'?'admin.html':'index.html'));
  }catch{clearAuth(res);return res.sendFile(path.join(__dirname,'public','login.html'));}
});
app.get('/admin',auth,admin,(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/student',auth,(req,res)=>{if(req.user.role!=='student')return res.redirect('/admin');res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'public','index.html'));});
app.get('/index.html',auth,(req,res)=>{if(req.user.role==='admin')return res.redirect('/admin');res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,'public','index.html'))});
app.use(express.static(path.join(__dirname,'public'),{index:false,setHeaders:(res,file)=>{if(/\.(html|js)$/.test(file))res.setHeader('Cache-Control','no-store')}}));

async function audit(actor,action,target,details={}){try{await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,details) VALUES($1,$2,$3,$4)',[actor?.id||null,action,target||null,JSON.stringify(details||{})])}catch(e){console.error('audit',e.message)}}
function makeStudentCode(){return 'DHY-'+new Date().getFullYear().toString().slice(-2)+'-'+crypto.randomBytes(3).toString('hex').toUpperCase()}
function makePassword(){return crypto.randomBytes(5).toString('base64url')+'@1'}
async function bootstrapTarkashContent(){
  const file=path.join(__dirname,'data','tarkash_annual_pyq_plus_2026_validated.json');
  if(!fs.existsSync(file)) return;
  const questions=JSON.parse(fs.readFileSync(file,'utf8'));
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const existing=await client.query("SELECT id FROM tests WHERE slug='tarkash-annual-pyq-plus-2026' LIMIT 1");
    let testId;
    if(existing.rows[0]){
      testId=existing.rows[0].id;
      await client.query(`UPDATE tests SET title=$1,institution=$2,category=$3,year=$4,sequence_no=$5,access_type=$6,duration_seconds=$7,published=TRUE,metadata=$8,updated_at=NOW() WHERE id=$9`,[
        'Tarkash Annual PYQ Plus — 2026 (High-Confidence Import)','Tarkash','BPSC PYQ Plus',2026,1,'premium',7200,
        JSON.stringify({source:'Tarkash Annual PYQ Plus English India.pdf',high_confidence_question_count:questions.length,held_for_review:84}),testId
      ]);
    }else{
      const t=(await client.query(`INSERT INTO tests(slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,question_count,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,TRUE,0,$9) RETURNING id`,[
        'tarkash-annual-pyq-plus-2026','Tarkash Annual PYQ Plus — 2026 (High-Confidence Import)','Tarkash','BPSC PYQ Plus',2026,1,'premium',7200,
        JSON.stringify({source:'Tarkash Annual PYQ Plus English India.pdf',high_confidence_question_count:questions.length,held_for_review:84})
      ])).rows[0];
      testId=t.id;
    }
    let order=1;
    for(const q of questions){
      await client.query(`INSERT INTO questions(id,subject,topic,subtopic,year,language,question_en,question_hi,options,answer,explanation_en,explanation_hi,difficulty,source,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,topic=EXCLUDED.topic,subtopic=EXCLUDED.subtopic,year=EXCLUDED.year,language=EXCLUDED.language,question_en=EXCLUDED.question_en,question_hi=EXCLUDED.question_hi,options=EXCLUDED.options,answer=EXCLUDED.answer,explanation_en=EXCLUDED.explanation_en,explanation_hi=EXCLUDED.explanation_hi,difficulty=EXCLUDED.difficulty,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=NOW()`,[
          q.id,q.subject,q.topic,q.subtopic,q.year,q.language,q.question_en,q.question_hi,JSON.stringify(q.options||[]),q.answer,q.explanation_en,q.explanation_hi,q.difficulty,q.source,JSON.stringify(q.metadata||{})
      ]);
      await client.query(`INSERT INTO test_questions(test_id,question_id,sort_order) VALUES($1,$2,$3) ON CONFLICT(test_id,question_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`,[testId,q.id,order++]);
    }
    await client.query(`UPDATE tests SET question_count=$1,updated_at=NOW() WHERE id=$2`,[questions.length,testId]);
    await client.query('COMMIT');
    console.log(`Tarkash content imported/updated: ${questions.length} high-confidence questions`);
  }catch(e){await client.query('ROLLBACK');console.error('Tarkash import failed:',e.message)}finally{client.release()}
}

async function bootstrapAdmin(){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)return;const email=process.env.ADMIN_EMAIL.trim().toLowerCase();const found=await pool.query('SELECT id FROM users WHERE email=$1',[email]);if(found.rows[0]){await pool.query("UPDATE users SET role='admin',status='active' WHERE email=$1",[email]);return}const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12);await pool.query("INSERT INTO users(student_code,email,password_hash,name,username,role,status) VALUES($1,$2,$3,$4,$5,'admin','active')",[makeStudentCode(),email,hash,process.env.ADMIN_NAME||'BPSC Nexus Admin',process.env.ADMIN_USERNAME||'admin']);console.log('Initial admin created:',email)}

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:true})}catch(e){res.status(503).json({ok:false,database:false,error:e.message})}});

app.post('/api/auth/register',async(req,res)=>{if(process.env.ALLOW_SELF_REGISTER!=='true')return res.status(403).json({error:'Student accounts are created by DHYEYA Admin. Please use your Student ID and password.'});const {email,password,name,username}=req.body||{};if(!email||!password||!name)return res.status(400).json({error:'Name, email and password are required'});if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});try{const hash=await bcrypt.hash(password,12);const code=makeStudentCode();const q=await pool.query(`INSERT INTO users(student_code,email,password_hash,name,username) VALUES($1,$2,$3,$4,$5) RETURNING *`,[code,email.trim().toLowerCase(),hash,name.trim(),username?.trim()||null]);setAuth(res,q.rows[0]);res.status(201).json({user:publicUser(q.rows[0])})}catch(e){res.status(409).json({error:e.code==='23505'?'Email, username or student ID already exists':'Could not create account'})}});
app.post('/api/auth/login',async(req,res)=>{const {identifier,password}=req.body||{};const login=String(identifier||req.body?.email||'').trim();if(!login||!password)return res.status(400).json({error:'User ID/email/username and password are required'});try{const q=await pool.query(`SELECT * FROM users WHERE lower(coalesce(email,''))=lower($1) OR lower(coalesce(username,''))=lower($1) OR lower(coalesce(student_code,''))=lower($1) LIMIT 1`,[login]);const u=q.rows[0];if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'Invalid credentials'});if(u.status!=='active')return res.status(403).json({error:'Account is '+u.status});await pool.query('UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1',[u.id]);setAuth(res,u);await audit(u,'login',u.id,{role:u.role});res.set('Cache-Control','no-store');res.json({user:publicUser({...u,last_login_at:new Date().toISOString()})})}catch(e){console.error('login',e);res.status(500).json({error:'Login service temporarily unavailable'})}});
app.post('/api/auth/logout',(req,res)=>{clearAuth(res);res.json({ok:true})});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:publicUser(req.user)}));
app.post('/api/auth/change-password',auth,async(req,res)=>{const current=String(req.body?.current_password||'');const next=String(req.body?.new_password||'');if(next.length<8)return res.status(400).json({error:'New password must be at least 8 characters'});if(current===next)return res.status(400).json({error:'New password must differ from current password'});try{const ok=await bcrypt.compare(current,req.user.password_hash);if(!ok)return res.status(401).json({error:'Current password is incorrect'});const hash=await bcrypt.hash(next,12);await pool.query('UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2',[hash,req.user.id]);await audit(req.user,'change_own_password',req.user.id,{});res.json({ok:true})}catch(e){res.status(500).json({error:'Could not change password'})}});
app.post('/api/presence/heartbeat',auth,async(req,res)=>{await pool.query(`INSERT INTO user_presence(user_id,last_seen_at) VALUES($1,NOW()) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=NOW()`,[req.user.id]);res.json({ok:true})});
app.get('/api/presence/online',auth,async(req,res)=>{const q=await pool.query(`SELECT u.id,u.name,u.username,u.student_code,u.xp,u.level,u.avatar_url FROM users u JOIN user_presence p ON p.user_id=u.id WHERE u.role='student' AND u.status='active' AND p.last_seen_at>NOW()-INTERVAL '45 seconds' AND u.id<>$1 ORDER BY p.last_seen_at DESC LIMIT 50`,[req.user.id]);res.json({users:q.rows})});

app.get('/api/notifications',auth,async(req,res)=>{const q=await pool.query(`SELECT n.id,n.title,n.message,n.type,n.link,n.created_at,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=$1 ORDER BY n.created_at DESC LIMIT 50`,[req.user.id]);res.json({notifications:q.rows,unread:q.rows.filter(x=>!x.read_at).length})});
app.patch('/api/notifications/:id/read',auth,async(req,res)=>{await pool.query(`UPDATE notification_recipients SET read_at=COALESCE(read_at,NOW()) WHERE notification_id=$1 AND user_id=$2`,[req.params.id,req.user.id]);res.json({ok:true})});

app.patch('/api/profile',auth,async(req,res)=>{const allowed=['name','username','avatar_url','bio','target_exam','target_attempt','exam_date','daily_target','language','notification_preferences','preferences'];const data=Object.fromEntries(Object.entries(req.body||{}).filter(([k])=>allowed.includes(k)));if(data.name!==undefined&&!String(data.name).trim())return res.status(400).json({error:'Name cannot be empty'});if(data.avatar_url!==undefined&&data.avatar_url!==null){const a=String(data.avatar_url);if(!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(a)&&!/^https?:\/\//.test(a))return res.status(400).json({error:'Invalid profile image'});if(a.length>1600000)return res.status(413).json({error:'Profile image is too large. Use an image under 1 MB.'})}if(data.daily_target!==undefined)data.daily_target=Math.min(1000,Math.max(1,Number(data.daily_target)||100));const keys=Object.keys(data);if(!keys.length)return res.json({user:publicUser(req.user)});const sets=[],vals=[];keys.forEach((k,i)=>{sets.push(`${k}=$${i+1}`);vals.push(data[k])});vals.push(req.user.id);try{const q=await pool.query(`UPDATE users SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);res.json({user:publicUser(q.rows[0])})}catch(e){res.status(409).json({error:e.code==='23505'?'Username already exists':'Profile update failed'})}});

// Planner
app.get('/api/planner',auth,async(req,res)=>{const date=req.query.date;const p=[req.user.id];let s='SELECT * FROM planner_tasks WHERE user_id=$1';if(date){p.push(date);s+=' AND task_date=$2'}s+=' ORDER BY task_date,priority DESC,created_at';res.json({tasks:(await pool.query(s,p)).rows})});
app.post('/api/planner',auth,async(req,res)=>{const {task_date,title,subject,target,priority}=req.body||{};if(!task_date||!title)return res.status(400).json({error:'Date and title are required'});const q=await pool.query(`INSERT INTO planner_tasks(user_id,task_date,title,subject,target,priority) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,task_date,title,subject||null,target??null,priority||'normal']);res.status(201).json({task:q.rows[0]})});
app.patch('/api/planner/:id',auth,async(req,res)=>{const {completed,title,subject,target,priority,task_date}=req.body||{};const q=await pool.query(`UPDATE planner_tasks SET completed=COALESCE($1,completed),title=COALESCE($2,title),subject=COALESCE($3,subject),target=COALESCE($4,target),priority=COALESCE($5,priority),task_date=COALESCE($6,task_date),completed_at=CASE WHEN COALESCE($1,completed)=TRUE THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$7 AND user_id=$8 RETURNING *`,[completed??null,title??null,subject??null,target??null,priority??null,task_date??null,req.params.id,req.user.id]);if(!q.rows[0])return res.status(404).json({error:'Task not found'});res.json({task:q.rows[0]})});
app.delete('/api/planner/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM planner_tasks WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.json({deleted:r.rowCount===1})});

// Test library + engine
app.get('/api/tests',auth,async(req,res)=>{const p=[];let s='SELECT * FROM tests WHERE published=TRUE';if(req.query.institution){p.push(req.query.institution);s+=' AND lower(institution)=lower($1)'}s+=' ORDER BY COALESCE(year,0) DESC,COALESCE(sequence_no,999999) ASC,title';res.json({tests:(await pool.query(s,p)).rows})});
app.get('/api/tests/:id/questions',auth,async(req,res)=>{const q=await pool.query(`SELECT q.*,t.title test_title,t.duration_seconds FROM test_questions tq JOIN questions q ON q.id=tq.question_id JOIN tests t ON t.id=tq.test_id WHERE tq.test_id=$1 AND t.published=TRUE ORDER BY tq.sort_order`,[req.params.id]);res.json({test:q.rows[0]?{id:req.params.id,title:q.rows[0].test_title,duration_seconds:q.rows[0].duration_seconds}:null,questions:q.rows})});
app.get('/api/pyq/archive',auth,async(_req,res)=>{const q=await pool.query(`SELECT t.id,t.title,t.institution,t.category,t.year,t.sequence_no,t.duration_seconds,t.question_count,t.published,COALESCE((SELECT json_agg(json_build_object('subject',s.subject,'count',s.count) ORDER BY s.subject) FROM (SELECT COALESCE(q.subject,'Uncategorized') subject,COUNT(*)::int count FROM test_questions tq JOIN questions q ON q.id=tq.question_id WHERE tq.test_id=t.id GROUP BY COALESCE(q.subject,'Uncategorized')) s),'[]'::json) AS subjects FROM tests t WHERE t.published=TRUE AND (lower(coalesce(t.category,''))='bpsc pyq archive' OR (lower(coalesce(t.institution,''))='bpsc' AND lower(coalesce(t.title,'')) LIKE '%pyq%')) ORDER BY COALESCE(t.year,0) DESC,COALESCE(t.sequence_no,999999) ASC,t.title`);res.json({tests:q.rows})});
app.post('/api/attempts',auth,async(req,res)=>{const x=req.body||{};const total=Number(x.total_questions||0),correct=Number(x.correct||0),incorrect=Number(x.incorrect||0),unattempted=Number(x.unattempted??Math.max(0,total-correct-incorrect));const accuracy=total?Number(((correct/total)*100).toFixed(2)):0;const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query(`INSERT INTO test_attempts(user_id,test_id,mode,score,total_questions,correct,incorrect,unattempted,accuracy,time_taken_seconds,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.user.id,x.test_id||'unknown',x.mode==='exam'?'exam':'practice',Number(x.score||0),total,correct,incorrect,unattempted,accuracy,Number(x.time_taken_seconds||0),x.started_at||null]);const attempt=q.rows[0];for(const qa of (Array.isArray(x.question_attempts)?x.question_attempts:[])){await client.query(`INSERT INTO question_attempts(user_id,attempt_id,question_id,selected_option,correct_option,is_correct,is_bookmarked,marked_for_review,time_spent_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[req.user.id,attempt.id,qa.question_id,qa.selected_option??null,qa.correct_option??null,qa.is_correct==null?null:!!qa.is_correct,!!qa.is_bookmarked,!!qa.marked_for_review,Number(qa.time_spent_seconds||0)]);if(qa.is_correct===false&&qa.question_id){await client.query(`INSERT INTO revision_items(user_id,question_id,source,reason,next_revision_date) VALUES($1,$2,$3,$4,CURRENT_DATE+1) ON CONFLICT(user_id,question_id) DO UPDATE SET reason='answered incorrectly',next_revision_date=CURRENT_DATE+1,updated_at=NOW()`,[req.user.id,qa.question_id,x.test_id||'test','answered incorrectly'])}}
const xp=Math.min(50,Math.max(10,Math.round(correct*2)));await client.query('INSERT INTO xp_ledger(user_id,action,source_id,xp_amount) VALUES($1,$2,$3,$4)',[req.user.id,'test_completed',attempt.id,xp]);const u=await client.query('UPDATE users SET xp=xp+$1,level=((xp+$1)/500)::int+1,last_activity_date=CURRENT_DATE,streak_days=CASE WHEN last_activity_date=CURRENT_DATE-1 THEN streak_days+1 WHEN last_activity_date=CURRENT_DATE THEN streak_days ELSE 1 END,updated_at=NOW() WHERE id=$2 RETURNING xp,level,streak_days',[xp,req.user.id]);await client.query("UPDATE quiz_sessions SET status='completed',updated_at=NOW() WHERE user_id=$1 AND status='in_progress' AND test_id=$2",[req.user.id,String(x.test_id||'')]);await client.query('COMMIT');res.status(201).json({attempt,awarded_xp:xp,student:u.rows[0]})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/attempts',auth,async(req,res)=>{res.json({attempts:(await pool.query('SELECT * FROM test_attempts WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 100',[req.user.id])).rows})});
app.get('/api/performance',auth,async(req,res)=>{const a=(await pool.query('SELECT * FROM test_attempts WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 100',[req.user.id])).rows;const qa=(await pool.query(`SELECT q.subject,COUNT(*) total,SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) correct,AVG(qa.time_spent_seconds) avg_time FROM question_attempts qa LEFT JOIN questions q ON q.id=qa.question_id WHERE qa.user_id=$1 GROUP BY q.subject ORDER BY total DESC`,[req.user.id])).rows;res.json({attempts:a,subjects:qa})});
app.get('/api/revision',auth,async(req,res)=>{const q=await pool.query(`SELECT r.*,q.question_en,q.question_hi,q.subject,q.topic,q.options,q.answer,q.explanation_en,q.explanation_hi FROM revision_items r LEFT JOIN questions q ON q.id=r.question_id WHERE r.user_id=$1 ORDER BY r.next_revision_date NULLS LAST,r.updated_at DESC`,[req.user.id]);res.json({items:q.rows})});
app.get('/api/xp',auth,async(req,res)=>{res.json({xp:req.user.xp,level:req.user.level,ledger:(await pool.query('SELECT * FROM xp_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.id])).rows})});
app.get('/api/leaderboard',auth,async(req,res)=>{res.json({leaders:(await pool.query(`SELECT id,student_code,name,username,xp,level,streak_days FROM users WHERE role='student' AND status='active' ORDER BY xp DESC,level DESC,created_at ASC LIMIT 100`)).rows})});

// Persistent in-progress quiz sessions
app.get('/api/quiz-sessions/current',auth,async(req,res)=>{
  const q=await pool.query("SELECT * FROM quiz_sessions WHERE user_id=$1 AND status='in_progress' ORDER BY updated_at DESC LIMIT 1",[req.user.id]);
  res.json({session:q.rows[0]||null});
});
app.post('/api/quiz-sessions',auth,async(req,res)=>{
  const b=req.body||{}; if(!b.test_id||!b.mode||!b.state)return res.status(400).json({error:'test_id, mode and state are required'});
  const mode=b.mode==='exam'?'exam':'practice';
  const client=await pool.connect();
  try{await client.query('BEGIN');
    await client.query("UPDATE quiz_sessions SET status='abandoned',updated_at=NOW() WHERE user_id=$1 AND status='in_progress'",[req.user.id]);
    const q=await client.query(`INSERT INTO quiz_sessions(user_id,test_id,mode,state,started_at,last_saved_at,updated_at) VALUES($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *`,[req.user.id,String(b.test_id),mode,b.state,b.started_at||new Date().toISOString()]);
    await client.query('COMMIT'); res.status(201).json({session:q.rows[0]});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}
});
app.patch('/api/quiz-sessions/current',auth,async(req,res)=>{
  const b=req.body||{}; if(!b.state)return res.status(400).json({error:'state is required'});
  const q=await pool.query("UPDATE quiz_sessions SET state=$1,last_saved_at=NOW(),updated_at=NOW() WHERE user_id=$2 AND status='in_progress' RETURNING *",[b.state,req.user.id]);
  if(!q.rows[0])return res.status(404).json({error:'No active quiz session'}); res.json({session:q.rows[0]});
});
app.delete('/api/quiz-sessions/current',auth,async(req,res)=>{await pool.query("UPDATE quiz_sessions SET status='abandoned',updated_at=NOW() WHERE user_id=$1 AND status='in_progress'",[req.user.id]);res.json({ok:true})});

// Admin Question Bank import — ongoing content management without GitHub updates.
function repairImportedUnicode(value){
  const s=String(value??'');
  if(!/(?:Ã|Â|à¤|à¦|â€|ðŸ)/.test(s)) return s;
  try{ const bytes=[...s].map(ch=>ch.charCodeAt(0)); if(bytes.some(c=>c>255)) return s; const fixed=Buffer.from(bytes).toString('utf8'); return fixed.includes('�')&&!s.includes('�')?s:fixed; }catch{return s;}
}
function cleanImportedField(value){return repairImportedUnicode(value).normalize('NFC').trim();}
function splitImportedBilingual(value){const s=cleanImportedField(value); const i=s.search(/[\u0900-\u097F]/); return i>=0?{en:s.slice(0,i).trim(),hi:s.slice(i).trim()}:{en:s,hi:''};}
function normalizeImportedQuestion(q, index){
  const raw={...(q||{})};
  const combined=splitImportedBilingual(raw.question_en??raw.question??raw.questionText??''); const question_en=combined.en;
  if(!question_en) throw new Error(`Row ${index}: question_en/question is required`);
  let options=raw.options;
  if(typeof options==='string'){
    try{options=JSON.parse(options)}catch{options=options.split(/\s*\|\s*/).map(x=>x.trim()).filter(Boolean)}
  }
  if(!Array.isArray(options)) options=[raw.option_a,raw.option_b,raw.option_c,raw.option_d,raw.option_e].filter(x=>x!==undefined&&x!==null&&String(x).trim()!=='');
  options=options.map(x=>typeof x==='object'&&x!==null?(x.text??x.label??JSON.stringify(x)):String(x).trim()).filter(Boolean);
  if(options.length<2) throw new Error(`Row ${index}: at least 2 options are required`);
  let answer=raw.answer??raw.correct_answer??raw.correctOption;
  if(answer===undefined||answer===null||(typeof answer==='string'&&!answer.trim())) answer=null;
  else if(typeof answer==='string'){
    const a=answer.trim().toUpperCase();
    if(a==='*') answer=null;
    else if(/^[ABCDE]$/.test(a)) answer={A:0,B:1,C:2,D:3,E:4}[a];
    else if(/^\d+$/.test(a)) answer=Number(a);
    else throw new Error(`Row ${index}: answer must be A-E, *, null, or a valid option index`);
  }else if(typeof answer==='number') answer=Number(answer);
  else throw new Error(`Row ${index}: answer must be A-E, *, null, or a valid option index`);
  if(answer!==null&&(!Number.isInteger(answer)||answer<0||answer>=options.length)) throw new Error(`Row ${index}: answer must be A-E, *, null, or a valid option index`);
  const fingerprint=crypto.createHash('sha256').update([question_en,JSON.stringify(options)].join('\n').trim().toLowerCase()).digest('hex').slice(0,24); const id=String(raw.id||`IMP-${fingerprint}`).trim();
  const metadata={...(raw.metadata&&typeof raw.metadata==='object'?raw.metadata:{})};
  for(const key of ['category','source_exam','source_page','page','source_image','source_image_url']) if(raw[key]!==undefined) metadata[key]=raw[key];
  const suppliedHi=cleanImportedField(raw.question_hi||''); const question_hi=(suppliedHi&&!suppliedHi.includes('�'))?suppliedHi:(combined.hi||null); const expCombined=splitImportedBilingual(raw.explanation_en??raw.explanation??''); const suppliedExpHi=cleanImportedField(raw.explanation_hi||''); const explanation_en=expCombined.en||null; const explanation_hi=(suppliedExpHi&&!suppliedExpHi.includes('�'))?suppliedExpHi:(expCombined.hi||null); return {id,subject:raw.subject||null,topic:raw.topic||null,subtopic:raw.subtopic||null,year:raw.year?Number(raw.year):null,language:raw.language||'bilingual',question_en,question_hi,options,answer,explanation_en,explanation_hi,difficulty:raw.difficulty||null,source:raw.source||'Admin Question Bank Import',metadata};
}
async function importQuestionsToDb(questions,testConfig=null,actor=null){
  const client=await pool.connect(); let inserted=0,updated=0,testId=null,mapped=0;
  try{
    await client.query('BEGIN');
    if(questions.length){
      const ids=questions.map(q=>q.id);
      const existingRows=await client.query('SELECT id FROM questions WHERE id = ANY($1::text[])',[ids]);
      const existing=new Set(existingRows.rows.map(r=>r.id));
      const values=[]; const params=[];
      for(let i=0;i<questions.length;i++){
        const q=questions[i], base=i*15;
        values.push(`($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15})`);
        params.push(q.id,q.subject,q.topic,q.subtopic,q.year,q.language,q.question_en,q.question_hi,JSON.stringify(q.options||[]),q.answer,q.explanation_en,q.explanation_hi,q.difficulty,q.source,JSON.stringify(q.metadata||{}));
        if(existing.has(q.id)) updated++; else inserted++;
      }
      await client.query(`INSERT INTO questions(id,subject,topic,subtopic,year,language,question_en,question_hi,options,answer,explanation_en,explanation_hi,difficulty,source,metadata)
        VALUES ${values.join(',')}
        ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,topic=EXCLUDED.topic,subtopic=EXCLUDED.subtopic,year=EXCLUDED.year,language=EXCLUDED.language,question_en=EXCLUDED.question_en,question_hi=EXCLUDED.question_hi,options=EXCLUDED.options,answer=EXCLUDED.answer,explanation_en=EXCLUDED.explanation_en,explanation_hi=EXCLUDED.explanation_hi,difficulty=EXCLUDED.difficulty,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=NOW()`,params);
    }
    if(testConfig?.test_id || testConfig?.title){
      if(testConfig?.test_id){
        const existingTest=await client.query('SELECT id FROM tests WHERE id=$1',[String(testConfig.test_id)]);
        if(!existingTest.rows[0]) throw new Error('Test not found for question mapping.');
        testId=existingTest.rows[0].id;
      }else{
        const title=String(testConfig.title).trim();
        const slug=String(testConfig.slug||title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).slice(0,180);
        const t=await client.query(`INSERT INTO tests(slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,question_count,metadata)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)
          ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,institution=EXCLUDED.institution,category=EXCLUDED.category,year=EXCLUDED.year,sequence_no=EXCLUDED.sequence_no,access_type=EXCLUDED.access_type,duration_seconds=EXCLUDED.duration_seconds,published=EXCLUDED.published,metadata=EXCLUDED.metadata,updated_at=NOW()
          RETURNING id`,[slug,title,testConfig.institution||null,testConfig.category||null,testConfig.year?Number(testConfig.year):null,testConfig.sequence_no?Number(testConfig.sequence_no):null,testConfig.access_type||'premium',Number(testConfig.duration_seconds||7200),testConfig.published!==false,JSON.stringify({created_via:'admin_question_bank'})]);
        testId=t.rows[0].id;
      }
      const offset=Math.max(0,Number(testConfig.sort_offset||0));
      for(let i=0;i<questions.length;i++){
        await client.query(`INSERT INTO test_questions(test_id,question_id,sort_order) VALUES($1,$2,$3) ON CONFLICT(test_id,question_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`,[testId,questions[i].id,offset+i+1]);
        mapped++;
      }
      await client.query(`UPDATE tests SET question_count=(SELECT COUNT(*) FROM test_questions WHERE test_id=$1),updated_at=NOW() WHERE id=$1`,[testId]);
    }
    await client.query('COMMIT');
    if(actor) await audit(actor,'question_bank_import',null,{inserted,updated,test_id:testId,mapped});
    return {inserted,updated,test_id:testId,mapped};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:1}});
function csvRows(text){
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i]; if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[];}else cell+=c;}
  if(cell!==''||row.length){row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row)}
  if(!rows.length)return [];
  const headers=rows.shift().map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_'));
  return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()])));
}
function splitPdfBlocks(text){
  const cleaned=String(text||'').replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n');
  return cleaned.split(/\n\s*(?=(?:Q(?:uestion)?\s*)?\d{1,4}[.)]\s+)/i).map(x=>x.trim()).filter(Boolean);
}
function parsePdfQuestionBlock(block,index){
  let s=block.replace(/^(?:Q(?:uestion)?\s*)?\d{1,4}[.)]\s*/i,'').trim();
  const answerMatch=s.match(/(?:^|\n)\s*(?:answer|ans|correct\s*answer)\s*[:\-]?\s*([ABCDE])\b/i);
  const explanationMatch=s.match(/(?:^|\n)\s*(?:explanation|solution)\s*[:\-]?\s*([\s\S]+)$/i);
  const answer=answerMatch?answerMatch[1].toUpperCase():null;
  if(answerMatch)s=s.slice(0,answerMatch.index).trim();
  let explanation=explanationMatch?explanationMatch[1].trim():null;
  if(explanationMatch)s=s.slice(0,explanationMatch.index).trim();
  const optRe=/(?:^|\n)\s*([A-E])[.)]\s+/gi, matches=[...s.matchAll(optRe)];
  if(matches.length<2)return null;
  const stem=s.slice(0,matches[0].index).trim();
  const options=matches.map((m,i)=>s.slice(m.index+m[0].length,i+1<matches.length?matches[i+1].index:s.length).trim()).filter(Boolean);
  if(!stem||options.length<2)return null;
  let question_type='mcq';
  if(/match\s+the\s+following|list\s*(i|1).*list\s*(ii|2)/i.test(stem)||/match\s+the\s+following/i.test(s))question_type='match';
  else if(/assertion\s*[:\-]|reason\s*[:\-]|assertion\s*\(a\).*reason\s*\(r\)/is.test(stem))question_type='assertion_reason';
  else if(/statement\s*[i1]|following\s+statements|which\s+of\s+the\s+statements/i.test(stem))question_type='statement';
  else if(/chronolog|arrange.*order|sequence/i.test(stem))question_type='sequence';
  const metadata={import_parser:'pdf-text',question_type,parse_confidence:answer?'high':'review'};
  const qbi=splitImportedBilingual(stem); const exi=splitImportedBilingual(explanation||''); if(qbi.en.includes('�')||exi.en.includes('�')) metadata.parse_confidence='review'; return {id:`PDF-${Date.now().toString(36)}-${index}-${crypto.randomBytes(3).toString('hex')}`,question_en:qbi.en,question_hi:qbi.hi||null,options:options.map(cleanImportedField),answer,explanation_en:exi.en||null,explanation_hi:exi.hi||null,source:'Admin PDF Import',metadata};
}
async function parseUploadedFile(file){
  const name=String(file.originalname||'').toLowerCase();
  if(name.endsWith('.json')){const data=JSON.parse(file.buffer.toString('utf8'));return Array.isArray(data)?data:(Array.isArray(data.questions)?data.questions:[])}
  if(name.endsWith('.csv'))return csvRows(file.buffer.toString('utf8'));
  if(name.endsWith('.pdf')){
    const parsed=await pdfParse(file.buffer); const blocks=splitPdfBlocks(parsed.text); const out=[]; const held=[];
    blocks.forEach((b,i)=>{const q=parsePdfQuestionBlock(b,i+1);if(q)out.push(q);else held.push({index:i+1,raw:b.slice(0,2000)})});
    return {questions:out,held,total_blocks:blocks.length,pages:parsed.numpages,text_chars:parsed.text.length};
  }
  throw new Error('Unsupported file. Use PDF, JSON or CSV.');
}
app.post('/api/admin/questions/parse-file',auth,admin,upload.single('file'),async(req,res)=>{
  try{if(!req.file)return res.status(400).json({error:'No file uploaded.'});const parsed=await parseUploadedFile(req.file);const questions=Array.isArray(parsed)?parsed:(parsed.questions||[]);if(!questions.length)return res.status(422).json({error:'No questions could be detected from this file.',held:parsed.held||[]});const normalized=[];for(let i=0;i<questions.length;i++)normalized.push(normalizeImportedQuestion(questions[i],i+1));res.json({ok:true,filename:req.file.originalname,total:normalized.length,questions:normalized,held:parsed.held||[],parser:{pages:parsed.pages||null,total_blocks:parsed.total_blocks||null,text_chars:parsed.text_chars||null}})}catch(e){res.status(400).json({error:e.message||'File parsing failed.'})}
});
app.post('/api/admin/questions/import',auth,admin,async(req,res)=>{
  try{
    const input=Array.isArray(req.body)?req.body:(Array.isArray(req.body?.questions)?req.body.questions:null);
    if(!input?.length)return res.status(400).json({error:'No questions supplied.'});
    if(input.length>50000)return res.status(400).json({error:'Maximum 50,000 questions per import.'});
    const seen=new Set(); const normalized=[];
    for(let i=0;i<input.length;i++){
      const q=normalizeImportedQuestion(input[i],i+1);
      if(seen.has(q.id)) throw new Error(`Duplicate question ID in upload: ${q.id}`);
      seen.add(q.id); normalized.push(q);
    }
    const test=req.body?.test&&typeof req.body.test==='object'?req.body.test:null;
    const result=await importQuestionsToDb(normalized,test,req.user);
    res.json({ok:true,total:normalized.length,...result});
  }catch(e){res.status(400).json({error:e.message||'Question import failed.'})}
});
app.get('/api/admin/questions',auth,admin,async(req,res)=>{
  const p=[]; let where=[];
  if(req.query.subject){p.push(String(req.query.subject));where.push(`lower(q.subject)=lower($${p.length})`)}
  if(req.query.test_id){p.push(String(req.query.test_id));where.push(`EXISTS (SELECT 1 FROM test_questions tqf WHERE tqf.test_id=$${p.length} AND tqf.question_id=q.id)`)}
  if(req.query.search){p.push('%'+String(req.query.search).toLowerCase()+'%');where.push(`(lower(q.question_en) LIKE $${p.length} OR lower(coalesce(q.question_hi,'')) LIKE $${p.length} OR lower(coalesce(q.topic,'')) LIKE $${p.length} OR lower(coalesce(q.source,'')) LIKE $${p.length} OR lower(q.id) LIKE $${p.length})`)}
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  const limit=Math.min(200,Math.max(1,Number(req.query.limit||100))); const offset=Math.max(0,Number(req.query.offset||0)); p.push(limit,offset);
  const q=await pool.query(`SELECT q.id,q.subject,q.topic,q.subtopic,q.year,q.language,q.question_en,q.question_hi,q.options,q.answer,q.explanation_en,q.explanation_hi,q.difficulty,q.source,q.metadata,q.created_at,q.updated_at,COALESCE((SELECT json_agg(json_build_object('id',t.id,'title',t.title) ORDER BY t.year DESC NULLS LAST,t.sequence_no ASC NULLS LAST,t.title) FROM test_questions tq2 JOIN tests t ON t.id=tq2.test_id WHERE tq2.question_id=q.id),'[]'::json) AS tests FROM questions q${clause} ORDER BY q.updated_at DESC LIMIT $${p.length-1} OFFSET $${p.length}`,p);
  const cP=[]; let cWhere=[];
  if(req.query.subject){cP.push(String(req.query.subject));cWhere.push(`lower(subject)=lower($${cP.length})`)}
  if(req.query.test_id){cP.push(String(req.query.test_id));cWhere.push(`EXISTS (SELECT 1 FROM test_questions tqf WHERE tqf.test_id=$${cP.length} AND tqf.question_id=questions.id)`)}
  if(req.query.search){cP.push('%'+String(req.query.search).toLowerCase()+'%');cWhere.push(`(lower(question_en) LIKE $${cP.length} OR lower(coalesce(question_hi,'')) LIKE $${cP.length} OR lower(coalesce(topic,'')) LIKE $${cP.length} OR lower(coalesce(source,'')) LIKE $${cP.length} OR lower(id) LIKE $${cP.length})`)}
  const c=await pool.query(`SELECT COUNT(*)::int count FROM questions${cWhere.length?' WHERE '+cWhere.join(' AND '):''}`,cP);
  res.json({questions:q.rows,total:c.rows[0].count});
});
app.get('/api/admin/question-bank/facets',auth,admin,async(_req,res)=>{const [s,y]=await Promise.all([pool.query("SELECT DISTINCT subject FROM questions WHERE subject IS NOT NULL AND trim(subject)<>'' ORDER BY subject"),pool.query("SELECT DISTINCT year FROM questions WHERE year IS NOT NULL ORDER BY year DESC")]);res.json({subjects:s.rows.map(r=>r.subject),years:y.rows.map(r=>r.year)});});
app.get('/api/admin/question-bank/tests',auth,admin,async(_req,res)=>{
  const q=await pool.query(`SELECT t.id,t.title,t.institution,t.category,t.year,t.sequence_no,t.duration_seconds,t.published,COUNT(tq.question_id)::int question_count FROM tests t LEFT JOIN test_questions tq ON tq.test_id=t.id GROUP BY t.id ORDER BY t.year DESC NULLS LAST,t.sequence_no ASC NULLS LAST,t.title`);
  res.json({tests:q.rows});
});
app.patch('/api/admin/questions/:id',auth,admin,async(req,res)=>{
  try{
    const existing=(await pool.query('SELECT * FROM questions WHERE id=$1',[req.params.id])).rows[0];
    if(!existing)return res.status(404).json({error:'Question not found'});
    const normalized=normalizeImportedQuestion({...existing,...(req.body||{}),id:req.params.id},1);
    await pool.query(`UPDATE questions SET subject=$2,topic=$3,subtopic=$4,year=$5,language=$6,question_en=$7,question_hi=$8,options=$9,answer=$10,explanation_en=$11,explanation_hi=$12,difficulty=$13,source=$14,metadata=$15,updated_at=NOW() WHERE id=$1`,[normalized.id,normalized.subject,normalized.topic,normalized.subtopic,normalized.year,normalized.language,normalized.question_en,normalized.question_hi,JSON.stringify(normalized.options),normalized.answer,normalized.explanation_en,normalized.explanation_hi,normalized.difficulty,normalized.source,JSON.stringify(normalized.metadata||{})]);
    await audit(req.user,'question_bank_edit',req.params.id,{});
    const q=(await pool.query('SELECT * FROM questions WHERE id=$1',[req.params.id])).rows[0];
    res.json({ok:true,question:q});
  }catch(e){res.status(400).json({error:e.message||'Question update failed.'})}
});
app.delete('/api/admin/questions/:id',auth,admin,async(req,res)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const exists=(await client.query('SELECT id FROM questions WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];if(!exists){await client.query('ROLLBACK');return res.status(404).json({error:'Question not found'})}
    await client.query('DELETE FROM questions WHERE id=$1',[req.params.id]);
    await client.query('COMMIT'); await audit(req.user,'question_bank_delete',req.params.id,{}); res.json({ok:true,deleted:1});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Question delete failed.'})}finally{client.release()}
});
app.post('/api/admin/questions/bulk-delete',auth,admin,async(req,res)=>{
  const ids=Array.isArray(req.body?.ids)?[...new Set(req.body.ids.map(String).filter(Boolean))]:[];
  if(!ids.length)return res.status(400).json({error:'No question IDs supplied.'});
  if(ids.length>1000)return res.status(400).json({error:'Maximum 1,000 questions per bulk delete.'});
  const client=await pool.connect();
  try{await client.query('BEGIN');const r=await client.query('DELETE FROM questions WHERE id = ANY($1::text[]) RETURNING id',[ids]);await client.query('COMMIT');await audit(req.user,'question_bank_bulk_delete',null,{requested:ids.length,deleted:r.rowCount});res.json({ok:true,deleted:r.rowCount,requested:ids.length});}
  catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Bulk delete failed.'})}finally{client.release()}
});
app.delete('/api/admin/tests/:id/questions',auth,admin,async(req,res)=>{
  const testId=String(req.params.id); const client=await pool.connect();
  try{await client.query('BEGIN');const t=(await client.query('SELECT id,title FROM tests WHERE id=$1 FOR UPDATE',[testId])).rows[0];if(!t){await client.query('ROLLBACK');return res.status(404).json({error:'Test not found'})}
    const mapped=(await client.query('SELECT COUNT(*)::int count FROM test_questions WHERE test_id=$1',[testId])).rows[0].count;
    await client.query('DELETE FROM test_questions WHERE test_id=$1',[testId]);await client.query('UPDATE tests SET question_count=0,updated_at=NOW() WHERE id=$1',[testId]);await client.query('COMMIT');await audit(req.user,'test_question_mapping_delete',testId,{test_title:t.title,deleted_mappings:mapped});res.json({ok:true,test_id:testId,deleted_mappings:mapped});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Could not clear test questions.'})}finally{client.release()}
});

// Admin
app.get('/api/admin/stats',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE role='student') users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='active') active_users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='blocked') blocked_users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='deactivated') deactivated_users,(SELECT COUNT(*) FROM tests) tests,(SELECT COUNT(*) FROM questions) questions,(SELECT COUNT(*) FROM test_attempts) attempts,(SELECT COALESCE(SUM(xp_amount),0) FROM xp_ledger) xp_awarded,(SELECT COUNT(*) FROM planner_tasks WHERE completed=FALSE) open_tasks`);res.json({stats:q.rows[0]})});
app.get('/api/admin/users',auth,admin,async(req,res)=>{const search=(req.query.search||'').trim();const status=req.query.status;const p=[];let s="SELECT id,student_code,email,name,username,role,status,target_exam,xp,level,streak_days,last_login_at,created_at FROM users WHERE role='student'";if(search){p.push('%'+search.toLowerCase()+'%');s+=` AND (lower(coalesce(name,'')) LIKE $${p.length} OR lower(coalesce(email,'')) LIKE $${p.length} OR lower(coalesce(username,'')) LIKE $${p.length} OR lower(coalesce(student_code,'')) LIKE $${p.length})`}if(status){p.push(status);s+=` AND status=$${p.length}`}s+=' ORDER BY created_at DESC LIMIT 500';res.json({users:(await pool.query(s,p)).rows})});
app.get('/api/admin/users/:id/activity',auth,admin,async(req,res)=>{const u=(await pool.query("SELECT id,student_code,email,name,username,status,last_login_at,created_at FROM users WHERE id=$1 AND role='student'",[req.params.id])).rows[0];if(!u)return res.status(404).json({error:'Student not found'});const logs=(await pool.query('SELECT action,details,created_at FROM audit_logs WHERE target_user_id=$1 ORDER BY created_at DESC LIMIT 500',[req.params.id])).rows;const attempts=(await pool.query('SELECT id,test_id,mode,score,total_questions,accuracy,submitted_at FROM test_attempts WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 100',[req.params.id])).rows;const battles=(await pool.query('SELECT id,status,subject,question_count,started_at,finished_at,winner_id FROM battle_rooms WHERE creator_id=$1 OR accepted_by=$1 ORDER BY created_at DESC LIMIT 100',[req.params.id])).rows;res.json({user:u,activity:logs,attempts,battles})});
app.post('/api/admin/users',auth,admin,async(req,res)=>{const b=req.body||{};const name=(b.name||'New Student').trim();const email=b.email?.trim().toLowerCase()||null;const username=b.username?.trim()||null;const password=b.password?.trim()||makePassword();const code=b.student_code?.trim()||makeStudentCode();if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});try{const hash=await bcrypt.hash(password,12);const q=await pool.query(`INSERT INTO users(student_code,email,password_hash,name,username,target_exam,daily_target,role,status) VALUES($1,$2,$3,$4,$5,$6,$7,'student','active') RETURNING *`,[code,email,hash,name,username,b.target_exam||'BPSC Prelims',Number(b.daily_target||100)]);await audit(req.user,'create_student',q.rows[0].id,{student_code:code});res.status(201).json({user:publicUser(q.rows[0]),credentials:{student_code:code,username:username||null,email,password}})}catch(e){res.status(409).json({error:e.code==='23505'?'Student ID, email or username already exists':'Could not create student'})}});
app.patch('/api/admin/users/:id/status',auth,admin,async(req,res)=>{const target=(await pool.query('SELECT id,role FROM users WHERE id=$1',[req.params.id])).rows[0];if(!target||target.role!=='student')return res.status(404).json({error:'Student not found'});const status=req.body?.status;if(!['active','blocked','deactivated'].includes(status))return res.status(400).json({error:'Invalid status'});if(req.params.id===req.user.id&&status!=='active')return res.status(400).json({error:'You cannot disable your own admin account'});const q=await pool.query("UPDATE users SET status=$1,updated_at=NOW() WHERE id=$2 AND role='student' RETURNING id,student_code,name,status",[status,req.params.id]);if(!q.rows[0])return res.status(404).json({error:'Student not found'});await audit(req.user,'change_user_status',req.params.id,{status});res.json({user:q.rows[0]})});
app.post('/api/admin/users/:id/reset-password',auth,admin,async(req,res)=>{const target=(await pool.query('SELECT id,role FROM users WHERE id=$1',[req.params.id])).rows[0];if(!target||target.role!=='student')return res.status(404).json({error:'Student not found'});const password=req.body?.password?.trim()||makePassword();if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});const hash=await bcrypt.hash(password,12);const q=await pool.query("UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2 AND role='student' RETURNING id,student_code,name",[hash,req.params.id]);if(!q.rows[0])return res.status(404).json({error:'Student not found'});await audit(req.user,'reset_password',req.params.id,{});res.json({user:q.rows[0],temporary_password:password})});
app.get('/api/admin/attempts',auth,admin,async(req,res)=>{const q=await pool.query(`SELECT a.*,u.student_code,u.name,u.email FROM test_attempts a JOIN users u ON u.id=a.user_id ORDER BY a.submitted_at DESC LIMIT 500`);res.json({attempts:q.rows})});
app.get('/api/admin/audit',auth,admin,async(req,res)=>{const q=await pool.query(`SELECT a.*,au.name actor_name,tu.name target_name FROM audit_logs a LEFT JOIN users au ON au.id=a.actor_user_id LEFT JOIN users tu ON tu.id=a.target_user_id ORDER BY a.created_at DESC LIMIT 500`);res.json({logs:q.rows})});
app.get('/api/admin/planner',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT p.*,u.student_code,u.name FROM planner_tasks p JOIN users u ON u.id=p.user_id ORDER BY p.task_date DESC,p.created_at DESC LIMIT 500`);res.json({tasks:q.rows})});
app.post('/api/admin/tests',auth,admin,async(req,res)=>{const b=req.body||{};if(!b.slug||!b.title)return res.status(400).json({error:'slug and title are required'});try{const q=await pool.query(`INSERT INTO tests(slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[b.slug,b.title,b.institution||null,b.category||null,b.year||null,b.sequence_no||null,b.access_type||'premium',Number(b.duration_seconds||7200),b.published!==false,JSON.stringify(b.metadata||{})]);await audit(req.user,'create_test',null,{test_id:q.rows[0].id,title:b.title});res.status(201).json({test:q.rows[0]})}catch(e){res.status(409).json({error:'Could not create test: '+e.message})}});
app.post('/api/admin/import',auth,admin,async(req,res)=>{const data=req.body||{};if(!Array.isArray(data.questions)&&!Array.isArray(data.tests))return res.status(400).json({error:'Send tests/questions/testQuestions arrays'});const client=await pool.connect();let qc=0,tc=0,tqc=0;try{await client.query('BEGIN');for(const t of data.tests||[]){await client.query(`INSERT INTO tests(id,slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,question_count,metadata) VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,institution=EXCLUDED.institution,category=EXCLUDED.category,year=EXCLUDED.year,sequence_no=EXCLUDED.sequence_no,duration_seconds=EXCLUDED.duration_seconds,published=EXCLUDED.published,metadata=EXCLUDED.metadata,updated_at=NOW()`,[t.id||null,t.slug,t.title,t.institution||null,t.category||null,t.year||null,t.sequence_no||null,t.access_type||'premium',Number(t.duration_seconds||7200),t.published!==false,Number(t.question_count||0),JSON.stringify(t.metadata||{})]);tc++}for(const q of data.questions||[]){await client.query(`INSERT INTO questions(id,subject,topic,subtopic,year,language,question_en,question_hi,options,answer,explanation_en,explanation_hi,difficulty,source,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,topic=EXCLUDED.topic,subtopic=EXCLUDED.subtopic,year=EXCLUDED.year,language=EXCLUDED.language,question_en=EXCLUDED.question_en,question_hi=EXCLUDED.question_hi,options=EXCLUDED.options,answer=EXCLUDED.answer,explanation_en=EXCLUDED.explanation_en,explanation_hi=EXCLUDED.explanation_hi,difficulty=EXCLUDED.difficulty,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=NOW()`,[q.id,q.subject||null,q.topic||null,q.subtopic||null,q.year||null,q.language||'bilingual',q.question_en||q.question||'',q.question_hi||null,JSON.stringify(q.options||[]),q.answer??null,q.explanation_en||null,q.explanation_hi||null,q.difficulty||null,q.source||null,JSON.stringify(q.metadata||{})]);qc++}for(const x of data.testQuestions||[]){await client.query(`INSERT INTO test_questions(test_id,question_id,sort_order) VALUES($1,$2,$3) ON CONFLICT(test_id,question_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`,[x.test_id,x.question_id,Number(x.sort_order||1)]);tqc++}await client.query(`UPDATE tests t SET question_count=(SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id=t.id)`);await client.query('COMMIT');await audit(req.user,'import_content',null,{tests:tc,questions:qc,testQuestions:tqc});res.json({ok:true,tests:tc,questions:qc,testQuestions:tqc})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});


// Admin notifications
app.post('/api/admin/notifications',auth,admin,async(req,res)=>{const b=req.body||{};if(!b.title||!b.message)return res.status(400).json({error:'Title and message are required'});const client=await pool.connect();try{await client.query('BEGIN');const n=await client.query(`INSERT INTO notifications(title,message,type,link,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[String(b.title).trim(),String(b.message).trim(),b.type||'announcement',b.link||null,req.user.id]);let users=[];if(Array.isArray(b.user_ids)&&b.user_ids.length){const q=await client.query(`SELECT id FROM users WHERE role='student' AND status='active' AND id=ANY($1::uuid[])`,[b.user_ids]);users=q.rows}else{const q=await client.query(`SELECT id FROM users WHERE role='student' AND status='active'`);users=q.rows}for(const u of users)await client.query(`INSERT INTO notification_recipients(notification_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[n.rows[0].id,u.id]);await client.query('COMMIT');await audit(req.user,'send_notification',null,{notification_id:n.rows[0].id,recipient_count:users.length});res.status(201).json({notification:n.rows[0],recipient_count:users.length})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/admin/notifications',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT n.*,COUNT(r.user_id)::int recipient_count,COUNT(r.read_at)::int read_count FROM notifications n LEFT JOIN notification_recipients r ON r.notification_id=n.id GROUP BY n.id ORDER BY n.created_at DESC LIMIT 100`);res.json({notifications:q.rows})});
app.get('/api/admin/attempts',auth,admin,async(req,res)=>{const q=await pool.query(`SELECT a.*,u.student_code,u.name,u.email FROM test_attempts a JOIN users u ON u.id=a.user_id ORDER BY a.submitted_at DESC LIMIT 500`);res.json({attempts:q.rows})});

// Battle Arena: polling-based realtime foundation; server is authoritative for matchmaking and scoring.
app.post('/api/battles',auth,async(req,res)=>{const b=req.body||{};const subject=b.subject?String(b.subject):null;const count=Math.min(20,Math.max(5,Number(b.question_count||20)));const seconds=Math.min(30,Math.max(10,Number(b.seconds_per_question||20)));const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query(`SELECT id FROM questions WHERE ($1::text IS NULL OR lower(subject)=lower($1)) ORDER BY random() LIMIT $2`,[subject,count]);if(q.rows.length<count){await client.query('ROLLBACK');return res.status(400).json({error:'Not enough questions for this battle.'})}const room=(await client.query(`INSERT INTO battle_rooms(creator_id,mode,subject,question_count,seconds_per_question,current_question_started_at) VALUES($1,'standard',$2,$3,$4,NULL) RETURNING *`,[req.user.id,subject,count,seconds])).rows[0];await client.query(`INSERT INTO battle_players(battle_id,user_id) VALUES($1,$2)`,[room.id,req.user.id]);for(let i=0;i<q.rows.length;i++)await client.query(`INSERT INTO battle_questions(battle_id,question_id,sort_order) VALUES($1,$2,$3)`,[room.id,q.rows[i].id,i]);await client.query('COMMIT');res.status(201).json({battle:room})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/battles/open',auth,async(req,res)=>{const q=await pool.query(`SELECT r.id,r.subject,r.question_count,r.seconds_per_question,r.created_at,u.name creator_name,u.student_code creator_code FROM battle_rooms r JOIN users u ON u.id=r.creator_id WHERE r.status='waiting' AND r.creator_id<>$1 ORDER BY r.created_at ASC LIMIT 25`,[req.user.id]);res.json({battles:q.rows})});
app.post('/api/battles/:id/accept',auth,async(req,res)=>{const client=await pool.connect();try{await client.query('BEGIN');const lock=await client.query(`UPDATE battle_rooms SET accepted_by=$1,status='active',started_at=NOW(),current_question_started_at=NOW(),updated_at=NOW() WHERE id=$2 AND status='waiting' AND creator_id<>$1 RETURNING *`,[req.user.id,req.params.id]);if(!lock.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:'Battle was already accepted or is unavailable.'})}await client.query(`INSERT INTO battle_players(battle_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[req.params.id,req.user.id]);await client.query('COMMIT');res.json({battle:lock.rows[0],accepted:true})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.get('/api/battles/:id',auth,async(req,res)=>{const b=(await pool.query(`SELECT r.*,cu.name creator_name,au.name accepted_name FROM battle_rooms r JOIN users cu ON cu.id=r.creator_id LEFT JOIN users au ON au.id=r.accepted_by WHERE r.id=$1`,[req.params.id])).rows[0];if(!b)return res.status(404).json({error:'Battle not found'});if(b.creator_id!==req.user.id&&b.accepted_by!==req.user.id)return res.status(403).json({error:'Not a participant'});const q=await pool.query(`SELECT bq.sort_order,q.id,q.question_en,q.question_hi,q.options,q.subject FROM battle_questions bq JOIN questions q ON q.id=bq.question_id WHERE bq.battle_id=$1 ORDER BY bq.sort_order`,[req.params.id]);const players=await pool.query(`SELECT bp.user_id,bp.score,bp.correct,bp.answered,u.name,u.student_code FROM battle_players bp JOIN users u ON u.id=bp.user_id WHERE bp.battle_id=$1`,[req.params.id]);res.json({battle:b,questions:q.rows,players:players.rows})});
app.post('/api/battles/:id/answer',auth,async(req,res)=>{const b=(await pool.query(`SELECT * FROM battle_rooms WHERE id=$1`,[req.params.id])).rows[0];if(!b||b.status!=='active')return res.status(400).json({error:'Battle is not active'});if(b.creator_id!==req.user.id&&b.accepted_by!==req.user.id)return res.status(403).json({error:'Not a participant'});if(b.current_question_started_at&&((Date.now()-new Date(b.current_question_started_at).getTime())/1000)>=Number(b.seconds_per_question))return res.status(409).json({error:'Question time has expired. Wait for the next question.'});const q=(await pool.query(`SELECT q.* FROM battle_questions bq JOIN questions q ON q.id=bq.question_id WHERE bq.battle_id=$1 AND bq.sort_order=$2`,[req.params.id,b.current_question])).rows[0];if(!q)return res.status(400).json({error:'Invalid battle question'});const sel=req.body?.selected_option==null?null:Number(req.body.selected_option);const isCorrect=sel!==null&&sel===q.answer;const timeMs=Math.max(0,Math.min(Number(b.seconds_per_question)*1000,b.current_question_started_at?Date.now()-new Date(b.current_question_started_at).getTime():0));const client=await pool.connect();try{await client.query('BEGIN');const ins=await client.query(`INSERT INTO battle_answers(battle_id,user_id,question_id,selected_option,is_correct,time_ms) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,[req.params.id,req.user.id,q.id,sel,isCorrect,timeMs]);if(!ins.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:'Already answered'})}const bonus=isCorrect?100+Math.max(0,20-Math.floor(timeMs/1000)):0;await client.query(`UPDATE battle_players SET score=score+$1,correct=correct+$2,answered=answered+1 WHERE battle_id=$3 AND user_id=$4`,[bonus,isCorrect?1:0,req.params.id,req.user.id]);const answered=(await client.query(`SELECT COUNT(*)::int c FROM battle_answers WHERE battle_id=$1 AND question_id=$2`,[req.params.id,q.id])).rows[0].c;if(answered>=2){const next=b.current_question+1;if(next>=b.question_count){const scores=(await client.query(`SELECT user_id,score FROM battle_players WHERE battle_id=$1 ORDER BY score DESC`,[req.params.id])).rows;const winner=scores[0]?.user_id||null;await client.query(`UPDATE battle_rooms SET status='completed',current_question=$1,winner_id=$2,finished_at=NOW(),updated_at=NOW() WHERE id=$3`,[next,winner,req.params.id]);for(const sp of scores){const xp=sp.user_id===winner?50:20;await client.query(`INSERT INTO xp_ledger(user_id,action,source_id,xp_amount) VALUES($1,'battle',$2,$3)`,[sp.user_id,req.params.id,xp]);await client.query(`UPDATE users SET xp=xp+$1,level=GREATEST(1,((xp+$1)/500)::int+1),updated_at=NOW() WHERE id=$2`,[xp,sp.user_id])}}else await client.query(`UPDATE battle_rooms SET current_question=$1,current_question_started_at=NOW(),updated_at=NOW() WHERE id=$2 AND current_question=$3`,[next,req.params.id,b.current_question])}await client.query('COMMIT');res.json({ok:true,is_correct:isCorrect,score_bonus:bonus})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.post('/api/battles/:id/timeout',auth,async(req,res)=>{const client=await pool.connect();try{await client.query('BEGIN');const b=(await client.query(`SELECT * FROM battle_rooms WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!b)return res.status(404).json({error:'Battle not found'});if(b.creator_id!==req.user.id&&b.accepted_by!==req.user.id)return res.status(403).json({error:'Not a participant'});if(b.status!=='active'){await client.query('ROLLBACK');return res.json({ok:true,status:b.status})}const elapsed=b.current_question_started_at?((Date.now()-new Date(b.current_question_started_at).getTime())/1000):0;if(elapsed < Number(b.seconds_per_question)){await client.query('ROLLBACK');return res.status(409).json({error:'Question timer has not expired'});}const q=(await client.query(`SELECT question_id FROM battle_questions WHERE battle_id=$1 AND sort_order=$2`,[b.id,b.current_question])).rows[0];if(q){const players=(await client.query(`SELECT user_id FROM battle_players WHERE battle_id=$1`,[b.id])).rows;for(const pl of players){const ins=await client.query(`INSERT INTO battle_answers(battle_id,user_id,question_id,selected_option,is_correct,time_ms) VALUES($1,$2,$3,NULL,FALSE,$4) ON CONFLICT DO NOTHING RETURNING user_id`,[b.id,pl.user_id,q.question_id,Number(b.seconds_per_question)*1000]);if(ins.rows[0])await client.query(`UPDATE battle_players SET answered=answered+1 WHERE battle_id=$1 AND user_id=$2 AND answered < $3`,[b.id,pl.user_id,b.question_count]);}}const next=Number(b.current_question)+1;if(next>=Number(b.question_count)){const scores=(await client.query(`SELECT user_id,score FROM battle_players WHERE battle_id=$1 ORDER BY score DESC,answered ASC`,[b.id])).rows;const winner=scores[0]?.user_id||null;await client.query(`UPDATE battle_rooms SET status='completed',current_question=$1,winner_id=$2,finished_at=NOW(),updated_at=NOW() WHERE id=$3`,[next,winner,b.id]);for(const sp of scores){const xp=sp.user_id===winner?50:20;await client.query(`INSERT INTO xp_ledger(user_id,action,source_id,xp_amount) VALUES($1,'battle',$2,$3)`,[sp.user_id,b.id,xp]);await client.query(`UPDATE users SET xp=xp+$1,level=GREATEST(1,((xp+$1)/500)::int+1),updated_at=NOW() WHERE id=$2`,[xp,sp.user_id]);}}else{await client.query(`UPDATE battle_rooms SET current_question=$1,current_question_started_at=NOW(),updated_at=NOW() WHERE id=$2`,[next,b.id]);}await client.query('COMMIT');res.json({ok:true,advanced:true})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
app.post('/api/battles/:id/cancel',auth,async(req,res)=>{const q=await pool.query(`UPDATE battle_rooms SET status='cancelled',updated_at=NOW() WHERE id=$1 AND creator_id=$2 AND status='waiting' RETURNING id`,[req.params.id,req.user.id]);res.json({ok:!!q.rows[0]})});
app.get('/api/battles/history',auth,async(req,res)=>{const q=await pool.query(`SELECT r.id,r.status,r.subject,r.question_count,r.started_at,r.finished_at,r.winner_id,cu.name creator_name,au.name opponent_name,p.score FROM battle_rooms r JOIN battle_players p ON p.battle_id=r.id AND p.user_id=$1 JOIN users cu ON cu.id=r.creator_id LEFT JOIN users au ON au.id=CASE WHEN r.creator_id=$1 THEN r.accepted_by ELSE r.creator_id END WHERE r.status='completed' ORDER BY r.finished_at DESC LIMIT 50`,[req.user.id]);res.json({battles:q.rows})});

app.use(async(req,res)=>res.status(404).sendFile(path.join(__dirname,'public',await hasValidSession(req)?'index.html':'login.html')));
const port=process.env.PORT||3000;
async function initializeDatabase(){
  const schemaPath=path.join(__dirname,'schema.sql');
  const schema=fs.readFileSync(schemaPath,'utf8');
  await pool.query(schema);

  // Production compatibility migrations. Older DHYEYA databases may already
  // contain these tables with an earlier column set. CREATE TABLE IF NOT EXISTS
  // does not add missing columns, so explicitly reconcile them before APIs run.
  const hasColumn = async (table, column) => {
    const r = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1`, [table, column]);
    return r.rowCount > 0;
  };
  const addColumn = async (table, column, definition) => {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  };

  // Notifications compatibility. This fixes legacy databases where the
  // notifications table existed before type/link/created_by were introduced.
  if (await hasColumn('notifications','id')) {
    await addColumn('notifications','type',"TEXT NOT NULL DEFAULT 'announcement'");
    await addColumn('notifications','link','TEXT');
    await addColumn('notifications','created_by','UUID');
    await addColumn('notifications','created_at','TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  }
  if (await hasColumn('notification_recipients','notification_id')) {
    await addColumn('notification_recipients','user_id','UUID');
    await addColumn('notification_recipients','read_at','TIMESTAMPTZ');
  }

  // Presence compatibility.
  if (await hasColumn('user_presence','user_id')) {
    await addColumn('user_presence','last_seen_at','TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  }

  // Battle compatibility.
  if (await hasColumn('battle_rooms','id')) {
    await addColumn('battle_rooms','creator_id','UUID');
    await addColumn('battle_rooms','accepted_by','UUID');
    await addColumn('battle_rooms','status',"TEXT NOT NULL DEFAULT 'waiting'");
    await addColumn('battle_rooms','mode',"TEXT NOT NULL DEFAULT 'standard'");
    await addColumn('battle_rooms','subject','TEXT');
    await addColumn('battle_rooms','question_count','INTEGER NOT NULL DEFAULT 20');
    await addColumn('battle_rooms','seconds_per_question','INTEGER NOT NULL DEFAULT 20');
    await addColumn('battle_rooms','current_question','INTEGER NOT NULL DEFAULT 0');
    await addColumn('battle_rooms','started_at','TIMESTAMPTZ');
    await addColumn('battle_rooms','finished_at','TIMESTAMPTZ');
    await addColumn('battle_rooms','winner_id','UUID');
    await addColumn('battle_rooms','created_at','TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    await addColumn('battle_rooms','updated_at','TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    await addColumn('battle_rooms','current_question_started_at','TIMESTAMPTZ');
  }
  if (await hasColumn('battle_players','battle_id')) {
    await addColumn('battle_players','user_id','UUID');
    await addColumn('battle_players','score','INTEGER NOT NULL DEFAULT 0');
    await addColumn('battle_players','correct','INTEGER NOT NULL DEFAULT 0');
    await addColumn('battle_players','answered','INTEGER NOT NULL DEFAULT 0');
  }
  if (await hasColumn('battle_questions','battle_id')) {
    await addColumn('battle_questions','question_id','TEXT');
    await addColumn('battle_questions','sort_order','INTEGER NOT NULL DEFAULT 0');
  }
  if (await hasColumn('battle_answers','battle_id')) {
    await addColumn('battle_answers','user_id','UUID');
    await addColumn('battle_answers','question_id','TEXT');
    await addColumn('battle_answers','selected_option','INTEGER');
    await addColumn('battle_answers','is_correct','BOOLEAN NOT NULL DEFAULT FALSE');
    await addColumn('battle_answers','time_ms','INTEGER NOT NULL DEFAULT 0');
    await addColumn('battle_answers','answered_at','TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  }

  // Legacy battle question IDs were sometimes UUID typed. If there are no
  // battle rows yet, safely normalize those columns to TEXT because the
  // canonical questions.id is TEXT.
  for (const table of ['battle_questions','battle_answers']) {
    if (await hasColumn(table,'question_id')) {
      const typ = await pool.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='question_id'`,[table]);
      if (typ.rows[0]?.data_type === 'uuid') {
        const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
        if (cnt.rows[0].c === 0) await pool.query(`ALTER TABLE ${table} ALTER COLUMN question_id TYPE TEXT USING question_id::text`);
      }
    }
  }

  // Legacy-safe indexes: create only after all compatibility ALTER TABLE
  // statements have completed, and only when the referenced columns exist.
  if (await hasColumn('test_questions','test_id') && await hasColumn('test_questions','sort_order')) {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_test_questions_order ON test_questions(test_id,sort_order)');
  }
  if (await hasColumn('test_questions','test_id') && await hasColumn('test_questions','question_id')) {
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_test_questions_pair ON test_questions(test_id,question_id) WHERE test_id IS NOT NULL AND question_id IS NOT NULL');
  }
  if (await hasColumn('question_attempts','user_id') && await hasColumn('question_attempts','question_id')) {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_question_attempts_user_question ON question_attempts(user_id,question_id)');
  }
  if (await hasColumn('battle_answers','battle_id') && await hasColumn('battle_answers','question_id')) {
    await pool.query('CREATE INDEX IF NOT EXISTS idx_battle_answers_room ON battle_answers(battle_id,question_id)');
  }
  console.log('Database schema initialized/verified');
}
app.listen(port,async()=>{
  try{
    await initializeDatabase();
    await bootstrapAdmin();
    await bootstrapTarkashContent();
    console.log('DHYEYA running on :'+port);
  }catch(e){
    console.error('Startup initialization failed:',e);
    process.exit(1);
  }
});;
