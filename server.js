import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const {Pool}=pg;
const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
const JWT_SECRET=process.env.JWT_SECRET;if(!JWT_SECRET)throw new Error('JWT_SECRET is required');
app.use(express.json({limit:'10mb'}));app.use(cookieParser());app.use(express.static(path.join(__dirname,'public')));

function sign(u){return jwt.sign({sub:u.id},JWT_SECRET,{expiresIn:'30d'})}
function setAuth(res,u){res.cookie('bpn_session',sign(u),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*24*60*60*1000,path:'/'})}
function clearAuth(res){res.clearCookie('bpn_session',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/'})}
function publicUser(u){return {id:u.id,student_code:u.student_code,email:u.email,name:u.name,username:u.username,avatar_url:u.avatar_url,bio:u.bio,role:u.role,status:u.status,target_exam:u.target_exam,exam_date:u.exam_date,daily_target:u.daily_target,xp:u.xp,level:u.level,streak_days:u.streak_days,last_activity_date:u.last_activity_date,last_login_at:u.last_login_at,preferences:u.preferences,created_at:u.created_at}}
async function auth(req,res,next){try{const t=req.cookies.bpn_session;if(!t)return res.status(401).json({error:'Authentication required'});const d=jwt.verify(t,JWT_SECRET);const q=await pool.query('SELECT * FROM users WHERE id=$1',[d.sub]);const u=q.rows[0];if(!u)return res.status(401).json({error:'Session expired'});if(u.status!=='active')return res.status(403).json({error:'Account is '+u.status});req.user=u;next()}catch{return res.status(401).json({error:'Invalid session'})}}
function admin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Admin access required'});next()}
async function audit(actor,action,target,details={}){try{await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,details) VALUES($1,$2,$3,$4)',[actor?.id||null,action,target||null,details])}catch(e){console.error('audit',e.message)}}
function makeStudentCode(){return 'DHY-'+new Date().getFullYear().toString().slice(-2)+'-'+crypto.randomBytes(3).toString('hex').toUpperCase()}
function makePassword(){return crypto.randomBytes(5).toString('base64url')+'@1'}
async function bootstrapAdmin(){if(!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)return;const email=process.env.ADMIN_EMAIL.trim().toLowerCase();const found=await pool.query('SELECT id FROM users WHERE email=$1',[email]);if(found.rows[0]){await pool.query("UPDATE users SET role='admin',status='active' WHERE email=$1",[email]);return}const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12);await pool.query("INSERT INTO users(student_code,email,password_hash,name,username,role,status) VALUES($1,$2,$3,$4,$5,'admin','active')",[makeStudentCode(),email,hash,process.env.ADMIN_NAME||'BPSC Nexus Admin',process.env.ADMIN_USERNAME||'admin']);console.log('Initial admin created:',email)}

app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:true})}catch(e){res.status(503).json({ok:false,database:false,error:e.message})}});

// DHYEYA V2 realtime layer: Server-Sent Events for notifications and battle events.
const liveClients=new Map();
function addLiveClient(userId,res){let set=liveClients.get(userId);if(!set){set=new Set();liveClients.set(userId,set)}set.add(res);return()=>{set.delete(res);if(!set.size)liveClients.delete(userId)}}
function sendLive(userId,type,payload){const set=liveClients.get(userId);if(!set)return;const packet=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const res of [...set]){try{res.write(packet)}catch{set.delete(res)}}}
function broadcastLive(type,payload,excludeIds=[]){const blocked=new Set(excludeIds);for(const userId of liveClients.keys())if(!blocked.has(userId))sendLive(userId,type,payload)}
app.get('/api/realtime',auth,async(req,res)=>{
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache, no-transform');res.setHeader('Connection','keep-alive');res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ok:true})}\n\n`);
  const remove=addLiveClient(req.user.id,res);
  await pool.query(`INSERT INTO user_presence(user_id,last_seen_at) VALUES($1,NOW()) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=NOW()`,[req.user.id]).catch(()=>{});
  const ping=setInterval(()=>{try{res.write(`: ping ${Date.now()}\n\n`)}catch{}},20000);
  req.on('close',()=>{clearInterval(ping);remove()});
});
app.post('/api/presence',auth,async(req,res)=>{await pool.query(`INSERT INTO user_presence(user_id,last_seen_at) VALUES($1,NOW()) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=NOW(),battle_id=COALESCE($2,user_presence.battle_id)`,[req.user.id,req.body?.battle_id||null]);res.json({ok:true})});

// Notifications
app.get('/api/notifications',auth,async(req,res)=>{
  const q=await pool.query(`SELECT n.id,n.title,n.message,n.notification_type,n.action_url,n.created_at,nr.read_at FROM notification_recipients nr JOIN notifications n ON n.id=nr.notification_id WHERE nr.user_id=$1 ORDER BY n.created_at DESC LIMIT 50`,[req.user.id]);
  res.json({notifications:q.rows,unread:q.rows.filter(x=>!x.read_at).length});
});
app.patch('/api/notifications/:id/read',auth,async(req,res)=>{const q=await pool.query(`UPDATE notification_recipients SET read_at=COALESCE(read_at,NOW()) WHERE notification_id=$1 AND user_id=$2 RETURNING notification_id,read_at`,[req.params.id,req.user.id]);if(!q.rows[0])return res.status(404).json({error:'Notification not found'});res.json({ok:true,notification:q.rows[0]})});
app.post('/api/notifications/:id/read',auth,async(req,res)=>{const q=await pool.query(`UPDATE notification_recipients SET read_at=COALESCE(read_at,NOW()) WHERE notification_id=$1 AND user_id=$2 RETURNING notification_id,read_at`,[req.params.id,req.user.id]);res.json({ok:!!q.rows[0]})});
app.get('/api/online-users',auth,async(req,res)=>{const q=await pool.query(`SELECT u.id,u.name,u.username,u.student_code,u.avatar_url,u.level,u.xp FROM user_presence p JOIN users u ON u.id=p.user_id WHERE u.status='active' AND u.role='student' AND p.last_seen_at>NOW()-INTERVAL '35 seconds' AND u.id<>$1 ORDER BY p.last_seen_at DESC LIMIT 100`,[req.user.id]);res.json({users:q.rows})});

// Admin broadcast notification. All current students receive a durable notification plus a realtime popup if online.
app.post('/api/admin/notifications',auth,admin,async(req,res)=>{
  const b=req.body||{};const title=String(b.title||'').trim(),message=String(b.message||'').trim();
  if(!title||!message)return res.status(400).json({error:'Title and message are required'});
  const type=String(b.notification_type||'announcement').slice(0,40);const actionUrl=b.action_url?String(b.action_url).slice(0,500):null;
  const client=await pool.connect();try{await client.query('BEGIN');
    const n=(await client.query(`INSERT INTO notifications(title,message,notification_type,action_url,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[title,message,type,actionUrl,req.user.id])).rows[0];
    const students=(await client.query(`SELECT id FROM users WHERE role='student' AND status='active'`)).rows;
    for(const u of students)await client.query(`INSERT INTO notification_recipients(notification_id,user_id,delivered_at) VALUES($1,$2,CASE WHEN EXISTS(SELECT 1 FROM user_presence p WHERE p.user_id=$2 AND p.last_seen_at>NOW()-INTERVAL '35 seconds') THEN NOW() ELSE NULL END) ON CONFLICT DO NOTHING`,[n.id,u.id]);
    await client.query('COMMIT');await audit(req.user,'broadcast_notification',null,{notification_id:n.id,title,recipients:students.length});
    for(const u of students)sendLive(u.id,'notification',{...n,read_at:null});
    res.status(201).json({notification:n,recipients:students.length});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}
});
app.get('/api/admin/notifications',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT n.*,COUNT(nr.user_id)::int recipients,COUNT(nr.read_at)::int read_count FROM notifications n LEFT JOIN notification_recipients nr ON nr.notification_id=n.id GROUP BY n.id ORDER BY n.created_at DESC LIMIT 100`);res.json({notifications:q.rows})});

// Battle Arena
app.post('/api/battles',auth,async(req,res)=>{
  const b=req.body||{};const count=Math.max(5,Math.min(30,Number(b.question_count||10)));const t=Math.max(10,Math.min(60,Number(b.time_per_question_seconds||20)));
  const client=await pool.connect();try{await client.query('BEGIN');
    const qs=(await client.query(`SELECT id FROM questions WHERE ($1::text IS NULL OR lower(subject)=lower($1)) AND ($2::text IS NULL OR lower(topic)=lower($2)) ORDER BY random() LIMIT $3`,[b.subject||null,b.topic||null,count])).rows;
    if(qs.length<count)throw Error(`Not enough questions available for this battle. Found ${qs.length}.`);
    const battle=(await client.query(`INSERT INTO battle_rooms(creator_user_id,status,subject,topic,difficulty,question_count,time_per_question_seconds) VALUES($1,'open',$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,b.subject||null,b.topic||null,b.difficulty||null,count,t])).rows[0];
    for(let i=0;i<qs.length;i++)await client.query(`INSERT INTO battle_questions(battle_id,question_no,question_id) VALUES($1,$2,$3)`,[battle.id,i+1,qs[i].id]);
    await client.query('COMMIT');
    const creator=publicUser(req.user);broadcastLive('battle_invite',{battle_id:battle.id,creator:{id:creator.id,name:creator.name,username:creator.username,student_code:creator.student_code,avatar_url:creator.avatar_url,level:creator.level,xp:creator.xp},subject:battle.subject,topic:battle.topic,question_count:battle.question_count,time_per_question_seconds:battle.time_per_question_seconds},[req.user.id]);
    res.status(201).json({battle});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}
});
app.get('/api/battles/open',auth,async(req,res)=>{const q=await pool.query(`SELECT b.id,b.subject,b.topic,b.difficulty,b.question_count,b.time_per_question_seconds,b.created_at,u.id creator_id,u.name creator_name,u.username creator_username,u.avatar_url creator_avatar,u.level creator_level FROM battle_rooms b JOIN users u ON u.id=b.creator_user_id WHERE b.status='open' AND b.creator_user_id<>$1 AND b.created_at>NOW()-INTERVAL '2 minutes' ORDER BY b.created_at DESC LIMIT 20`,[req.user.id]);res.json({battles:q.rows})});
app.post('/api/battles/:id/accept',auth,async(req,res)=>{
  const client=await pool.connect();try{await client.query('BEGIN');
    const q=await client.query(`SELECT * FROM battle_rooms WHERE id=$1 FOR UPDATE`,[req.params.id]);const b=q.rows[0];if(!b)throw Error('Battle not found');if(b.status!=='open')throw Error('Battle has already been accepted');if(b.creator_user_id===req.user.id)throw Error('You cannot accept your own battle');
    const online=(await client.query(`SELECT 1 FROM user_presence WHERE user_id=$1 AND last_seen_at>NOW()-INTERVAL '35 seconds'`,[req.user.id])).rows[0];if(!online)throw Error('You are offline. Reconnect and try again.');
    const upd=(await client.query(`UPDATE battle_rooms SET opponent_user_id=$1,status='starting',accepted_at=NOW() WHERE id=$2 AND status='open' RETURNING *`,[req.user.id,b.id])).rows[0];
    if(!upd)throw Error('Battle was accepted by another player first');
    await client.query(`UPDATE user_presence SET battle_id=$1,last_seen_at=NOW() WHERE user_id IN ($2,$3)`,[b.id,b.creator_user_id,req.user.id]);await client.query('COMMIT');
    sendLive(b.creator_user_id,'battle_accepted',{battle_id:b.id,opponent:{id:req.user.id,name:req.user.name,username:req.user.username,avatar_url:req.user.avatar_url,level:req.user.level}});sendLive(req.user.id,'battle_accepted',{battle_id:b.id,opponent:{id:b.creator_user_id}});
    res.json({battle:upd});
  }catch(e){await client.query('ROLLBACK');res.status(409).json({error:e.message})}finally{client.release()}
});
app.get('/api/battles/:id',auth,async(req,res)=>{
  const q=await pool.query(`SELECT b.*,cu.name creator_name,cu.username creator_username,cu.avatar_url creator_avatar,cu.level creator_level,ou.name opponent_name,ou.username opponent_username,ou.avatar_url opponent_avatar,ou.level opponent_level FROM battle_rooms b JOIN users cu ON cu.id=b.creator_user_id LEFT JOIN users ou ON ou.id=b.opponent_user_id WHERE b.id=$1 AND (b.creator_user_id=$2 OR b.opponent_user_id=$2)`,[req.params.id,req.user.id]);const b=q.rows[0];if(!b)return res.status(404).json({error:'Battle not found'});const qs=await pool.query(`SELECT bq.question_no,q.id,q.subject,q.topic,q.question_en,q.question_hi,q.options FROM battle_questions bq JOIN questions q ON q.id=bq.question_id WHERE bq.battle_id=$1 ORDER BY bq.question_no`,[b.id]);const ans=await pool.query(`SELECT user_id,question_no,selected_option,is_correct,response_ms,points FROM battle_answers WHERE battle_id=$1 ORDER BY question_no`,[b.id]);const safeAnswers=ans.rows.map(a=>a.user_id===req.user.id?a:{user_id:a.user_id,question_no:a.question_no,answered:true,points:a.points});res.json({battle:b,questions:qs.rows,answers:safeAnswers});
});
app.post('/api/battles/:id/start',auth,async(req,res)=>{const q=await pool.query(`UPDATE battle_rooms SET status='active',started_at=COALESCE(started_at,NOW()) WHERE id=$1 AND status IN ('starting','active') AND (creator_user_id=$2 OR opponent_user_id=$2) RETURNING *`,[req.params.id,req.user.id]);if(!q.rows[0])return res.status(409).json({error:'Battle cannot be started'});const b=q.rows[0];if(b.creator_user_id)sendLive(b.creator_user_id,'battle_started',{battle_id:b.id});if(b.opponent_user_id)sendLive(b.opponent_user_id,'battle_started',{battle_id:b.id});res.json({battle:b})});
app.post('/api/battles/:id/answer',auth,async(req,res)=>{
  const battleId=req.params.id,questionNo=Number(req.body?.question_no);const selected=req.body?.selected_option===null||req.body?.selected_option===undefined?null:Number(req.body.selected_option);const responseMs=Math.max(0,Number(req.body?.response_ms||0));
  const client=await pool.connect();try{await client.query('BEGIN');const bq=(await client.query(`SELECT b.*,bq.question_id,q.answer FROM battle_rooms b JOIN battle_questions bq ON bq.battle_id=b.id AND bq.question_no=$2 JOIN questions q ON q.id=bq.question_id WHERE b.id=$1 AND (b.creator_user_id=$3 OR b.opponent_user_id=$3) FOR UPDATE`,[battleId,questionNo,req.user.id])).rows[0];if(!bq)throw Error('Battle/question not found');if(!['active','starting'].includes(bq.status))throw Error('Battle is not active');
    const correct=selected!==null&&bq.answer!==null&&selected===Number(bq.answer);const points=correct?100+Math.max(0,20-Math.floor(responseMs/1000)):0;
    const ins=await client.query(`INSERT INTO battle_answers(battle_id,user_id,question_no,selected_option,is_correct,response_ms,points) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(battle_id,user_id,question_no) DO UPDATE SET selected_option=EXCLUDED.selected_option,is_correct=EXCLUDED.is_correct,response_ms=EXCLUDED.response_ms,points=EXCLUDED.points RETURNING *`,[battleId,req.user.id,questionNo,selected,correct,responseMs,points]);
    const stats=(await client.query(`SELECT user_id,COALESCE(SUM(points),0)::int score,COUNT(*)::int answered FROM battle_answers WHERE battle_id=$1 GROUP BY user_id`,[battleId])).rows;
    const done=(await client.query(`SELECT COUNT(*)::int c FROM battle_answers WHERE battle_id=$1`,[battleId])).rows[0].c >= bq.question_count*2;
    let final=null;if(done){const winner=(await client.query(`SELECT user_id,score FROM (SELECT user_id,SUM(points)::int score FROM battle_answers WHERE battle_id=$1 GROUP BY user_id) x ORDER BY score DESC LIMIT 1`,[battleId])).rows[0];final=(await client.query(`UPDATE battle_rooms SET status='completed',completed_at=NOW(),winner_user_id=$1 WHERE id=$2 RETURNING *`,[winner?.user_id||null,battleId])).rows[0]}
    await client.query('COMMIT');const opponentId=bq.creator_user_id===req.user.id?bq.opponent_user_id:bq.creator_user_id;if(opponentId)sendLive(opponentId,'battle_progress',{battle_id:battleId,question_no:questionNo,from_user_id:req.user.id,score:stats.find(x=>x.user_id===req.user.id)?.score||0,completed:!!final});if(final){sendLive(bq.creator_user_id,'battle_complete',{battle_id:battleId,winner_user_id:final.winner_user_id});if(bq.opponent_user_id)sendLive(bq.opponent_user_id,'battle_complete',{battle_id:battleId,winner_user_id:final.winner_user_id})}
    res.json({answer:ins.rows[0],scores:stats,battle:final||bq});
  }catch(e){await client.query('ROLLBACK');res.status(409).json({error:e.message})}finally{client.release()}
});
app.post('/api/battles/:id/cancel',auth,async(req,res)=>{const q=await pool.query(`UPDATE battle_rooms SET status=CASE WHEN status='open' THEN 'cancelled' ELSE status END WHERE id=$1 AND creator_user_id=$2 RETURNING *`,[req.params.id,req.user.id]);if(!q.rows[0])return res.status(404).json({error:'Battle not found'});broadcastLive('battle_cancelled',{battle_id:req.params.id});res.json({battle:q.rows[0]})});


app.post('/api/auth/register',async(req,res)=>{const {email,password,name,username}=req.body||{};if(!email||!password||!name)return res.status(400).json({error:'Name, email and password are required'});if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});try{const hash=await bcrypt.hash(password,12);const code=makeStudentCode();const q=await pool.query(`INSERT INTO users(student_code,email,password_hash,name,username) VALUES($1,$2,$3,$4,$5) RETURNING *`,[code,email.trim().toLowerCase(),hash,name.trim(),username?.trim()||null]);setAuth(res,q.rows[0]);res.status(201).json({user:publicUser(q.rows[0])})}catch(e){res.status(409).json({error:e.code==='23505'?'Email, username or student ID already exists':'Could not create account'})}});
app.post('/api/auth/login',async(req,res)=>{const {identifier,password}=req.body||{};const login=(identifier||req.body?.email||'').trim();if(!login||!password)return res.status(400).json({error:'User ID/email/username and password are required'});const q=await pool.query(`SELECT * FROM users WHERE lower(coalesce(email,''))=lower($1) OR lower(coalesce(username,''))=lower($1) OR lower(coalesce(student_code,''))=lower($1) LIMIT 1`,[login]);const u=q.rows[0];if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'Invalid credentials'});if(u.status!=='active')return res.status(403).json({error:'Account is '+u.status});await pool.query('UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1',[u.id]);setAuth(res,u);res.json({user:publicUser({...u,last_login_at:new Date().toISOString()})})});
app.post('/api/auth/logout',(req,res)=>{clearAuth(res);res.json({ok:true})});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:publicUser(req.user)}));
app.patch('/api/profile',auth,async(req,res)=>{const allowed=['name','username','avatar_url','bio','target_exam','exam_date','daily_target','preferences'];const raw=req.body||{};if(raw.name!==undefined&&!String(raw.name).trim())return res.status(400).json({error:'Display name is required'});if(raw.username&& !/^[A-Za-z0-9._-]{3,30}$/.test(String(raw.username)))return res.status(400).json({error:'Username must be 3–30 characters and use only letters, numbers, dot, underscore or hyphen'});if(raw.avatar_url&&String(raw.avatar_url).length>1500000)return res.status(413).json({error:'Profile image is too large. Please choose a smaller image.'});const data=Object.fromEntries(Object.entries(raw).filter(([k])=>allowed.includes(k)));const keys=Object.keys(data);if(!keys.length)return res.json({user:publicUser(req.user)});const sets=[],vals=[];keys.forEach((k,i)=>{sets.push(`${k}=$${i+1}`);vals.push(data[k])});vals.push(req.user.id);try{const q=await pool.query(`UPDATE users SET ${sets.join(',')},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);res.json({user:publicUser(q.rows[0])})}catch(e){res.status(409).json({error:e.code==='23505'?'Username already exists':'Profile update failed'})}});

// Planner
app.get('/api/planner',auth,async(req,res)=>{const date=req.query.date;const p=[req.user.id];let s='SELECT * FROM planner_tasks WHERE user_id=$1';if(date){p.push(date);s+=' AND task_date=$2'}s+=' ORDER BY task_date,priority DESC,created_at';res.json({tasks:(await pool.query(s,p)).rows})});
app.post('/api/planner',auth,async(req,res)=>{const {task_date,title,subject,target,priority}=req.body||{};if(!task_date||!title)return res.status(400).json({error:'Date and title are required'});const q=await pool.query(`INSERT INTO planner_tasks(user_id,task_date,title,subject,target,priority) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,task_date,title,subject||null,target??null,priority||'normal']);res.status(201).json({task:q.rows[0]})});
app.patch('/api/planner/:id',auth,async(req,res)=>{const {completed,title,subject,target,priority,task_date}=req.body||{};const q=await pool.query(`UPDATE planner_tasks SET completed=COALESCE($1,completed),title=COALESCE($2,title),subject=COALESCE($3,subject),target=COALESCE($4,target),priority=COALESCE($5,priority),task_date=COALESCE($6,task_date),completed_at=CASE WHEN COALESCE($1,completed)=TRUE THEN COALESCE(completed_at,NOW()) ELSE NULL END,updated_at=NOW() WHERE id=$7 AND user_id=$8 RETURNING *`,[completed??null,title??null,subject??null,target??null,priority??null,task_date??null,req.params.id,req.user.id]);if(!q.rows[0])return res.status(404).json({error:'Task not found'});res.json({task:q.rows[0]})});
app.delete('/api/planner/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM planner_tasks WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]);res.json({deleted:r.rowCount===1})});

// Test library + engine
app.get('/api/tests',auth,async(req,res)=>{const p=[];let s='SELECT * FROM tests WHERE published=TRUE';if(req.query.institution){p.push(req.query.institution);s+=' AND lower(institution)=lower($1)'}s+=' ORDER BY COALESCE(year,0) DESC,COALESCE(sequence_no,999999) ASC,title';res.json({tests:(await pool.query(s,p)).rows})});
app.get('/api/tests/:id/questions',auth,async(req,res)=>{const q=await pool.query(`SELECT q.*,t.title test_title,t.duration_seconds FROM test_questions tq JOIN questions q ON q.id=tq.question_id JOIN tests t ON t.id=tq.test_id WHERE tq.test_id=$1 AND t.published=TRUE ORDER BY tq.sort_order`,[req.params.id]);res.json({test:q.rows[0]?{id:req.params.id,title:q.rows[0].test_title,duration_seconds:q.rows[0].duration_seconds}:null,questions:q.rows})});
app.post('/api/attempts',auth,async(req,res)=>{const x=req.body||{};const total=Number(x.total_questions||0),correct=Number(x.correct||0),incorrect=Number(x.incorrect||0),unattempted=Number(x.unattempted??Math.max(0,total-correct-incorrect));const accuracy=total?Number(((correct/total)*100).toFixed(2)):0;const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query(`INSERT INTO test_attempts(user_id,test_id,mode,score,total_questions,correct,incorrect,unattempted,accuracy,time_taken_seconds,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[req.user.id,x.test_id||'unknown',x.mode==='exam'?'exam':'practice',Number(x.score||0),total,correct,incorrect,unattempted,accuracy,Number(x.time_taken_seconds||0),x.started_at||null]);const attempt=q.rows[0];for(const qa of (Array.isArray(x.question_attempts)?x.question_attempts:[])){await client.query(`INSERT INTO question_attempts(user_id,attempt_id,question_id,selected_option,correct_option,is_correct,is_bookmarked,marked_for_review,time_spent_seconds) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[req.user.id,attempt.id,qa.question_id,qa.selected_option??null,qa.correct_option??null,!!qa.is_correct,!!qa.is_bookmarked,!!qa.marked_for_review,Number(qa.time_spent_seconds||0)]);if(qa.is_correct===false&&qa.question_id){await client.query(`INSERT INTO revision_items(user_id,question_id,source,reason,next_revision_date) VALUES($1,$2,$3,$4,CURRENT_DATE+1) ON CONFLICT(user_id,question_id) DO UPDATE SET reason='answered incorrectly',next_revision_date=CURRENT_DATE+1,updated_at=NOW()`,[req.user.id,qa.question_id,x.test_id||'test','answered incorrectly'])}}
const xp=Math.min(50,Math.max(10,Math.round(correct*2)));await client.query('INSERT INTO xp_ledger(user_id,action,source_id,xp_amount) VALUES($1,$2,$3,$4)',[req.user.id,'test_completed',attempt.id,xp]);const u=await client.query('UPDATE users SET xp=xp+$1,level=FLOOR((xp+$1)/500)+1,last_activity_date=CURRENT_DATE,streak_days=CASE WHEN last_activity_date=CURRENT_DATE-1 THEN streak_days+1 WHEN last_activity_date=CURRENT_DATE THEN streak_days ELSE 1 END,updated_at=NOW() WHERE id=$2 RETURNING xp,level,streak_days',[xp,req.user.id]);await client.query("UPDATE quiz_sessions SET status='completed',updated_at=NOW() WHERE user_id=$1 AND status='in_progress' AND test_id=$2",[req.user.id,String(x.test_id||'')]);await client.query('COMMIT');res.status(201).json({attempt,awarded_xp:xp,student:u.rows[0]})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});
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

// Admin
app.get('/api/admin/stats',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT (SELECT COUNT(*) FROM users WHERE role='student') users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='active') active_users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='blocked') blocked_users,(SELECT COUNT(*) FROM users WHERE role='student' AND status='deactivated') deactivated_users,(SELECT COUNT(*) FROM tests) tests,(SELECT COUNT(*) FROM questions) questions,(SELECT COUNT(*) FROM test_attempts) attempts,(SELECT COALESCE(SUM(xp_amount),0) FROM xp_ledger) xp_awarded,(SELECT COUNT(*) FROM planner_tasks WHERE completed=FALSE) open_tasks`);res.json({stats:q.rows[0]})});
app.get('/api/admin/users',auth,admin,async(req,res)=>{const search=(req.query.search||'').trim();const status=req.query.status;const p=[];let s='SELECT id,student_code,email,name,username,role,status,target_exam,xp,level,streak_days,last_login_at,created_at FROM users WHERE 1=1';if(search){p.push('%'+search.toLowerCase()+'%');s+=` AND (lower(coalesce(name,'')) LIKE $${p.length} OR lower(coalesce(email,'')) LIKE $${p.length} OR lower(coalesce(username,'')) LIKE $${p.length} OR lower(coalesce(student_code,'')) LIKE $${p.length})`}if(status){p.push(status);s+=` AND status=$${p.length}`}s+=' ORDER BY created_at DESC LIMIT 500';res.json({users:(await pool.query(s,p)).rows})});
app.post('/api/admin/users',auth,admin,async(req,res)=>{const b=req.body||{};const name=(b.name||'New Student').trim();const email=b.email?.trim().toLowerCase()||null;const username=b.username?.trim()||null;const password=b.password?.trim()||makePassword();const code=b.student_code?.trim()||makeStudentCode();if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});try{const hash=await bcrypt.hash(password,12);const q=await pool.query(`INSERT INTO users(student_code,email,password_hash,name,username,target_exam,daily_target,role,status) VALUES($1,$2,$3,$4,$5,$6,$7,'student','active') RETURNING *`,[code,email,hash,name,username,b.target_exam||'BPSC Prelims',Number(b.daily_target||100)]);await audit(req.user,'create_student',q.rows[0].id,{student_code:code});res.status(201).json({user:publicUser(q.rows[0]),credentials:{student_code:code,username:username||null,email,password}})}catch(e){res.status(409).json({error:e.code==='23505'?'Student ID, email or username already exists':'Could not create student'})}});
app.patch('/api/admin/users/:id/status',auth,admin,async(req,res)=>{const status=req.body?.status;if(!['active','blocked','deactivated'].includes(status))return res.status(400).json({error:'Invalid status'});if(req.params.id===req.user.id&&status!=='active')return res.status(400).json({error:'You cannot disable your own admin account'});const q=await pool.query("UPDATE users SET status=$1,updated_at=NOW() WHERE id=$2 AND role='student' RETURNING id,student_code,name,status",[status,req.params.id]);if(!q.rows[0])return res.status(404).json({error:'Student not found'});await audit(req.user,'change_user_status',req.params.id,{status});res.json({user:q.rows[0]})});
app.post('/api/admin/users/:id/reset-password',auth,admin,async(req,res)=>{const password=req.body?.password?.trim()||makePassword();if(password.length<8)return res.status(400).json({error:'Password must be at least 8 characters'});const hash=await bcrypt.hash(password,12);const q=await pool.query("UPDATE users SET password_hash=$1,updated_at=NOW() WHERE id=$2 AND role='student' RETURNING id,student_code,name",[hash,req.params.id]);if(!q.rows[0])return res.status(404).json({error:'Student not found'});await audit(req.user,'reset_password',req.params.id,{});res.json({user:q.rows[0],temporary_password:password})});
app.get('/api/admin/attempts',auth,admin,async(req,res)=>{const q=await pool.query(`SELECT a.*,u.student_code,u.name,u.email FROM test_attempts a JOIN users u ON u.id=a.user_id ORDER BY a.submitted_at DESC LIMIT 500`);res.json({attempts:q.rows})});
app.get('/api/admin/audit',auth,admin,async(req,res)=>{const q=await pool.query(`SELECT a.*,au.name actor_name,tu.name target_name FROM audit_logs a LEFT JOIN users au ON au.id=a.actor_user_id LEFT JOIN users tu ON tu.id=a.target_user_id ORDER BY a.created_at DESC LIMIT 500`);res.json({logs:q.rows})});
app.get('/api/admin/planner',auth,admin,async(_req,res)=>{const q=await pool.query(`SELECT p.*,u.student_code,u.name FROM planner_tasks p JOIN users u ON u.id=p.user_id ORDER BY p.task_date DESC,p.created_at DESC LIMIT 500`);res.json({tasks:q.rows})});
app.post('/api/admin/tests',auth,admin,async(req,res)=>{const b=req.body||{};if(!b.slug||!b.title)return res.status(400).json({error:'slug and title are required'});try{const q=await pool.query(`INSERT INTO tests(slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[b.slug,b.title,b.institution||null,b.category||null,b.year||null,b.sequence_no||null,b.access_type||'premium',Number(b.duration_seconds||7200),b.published!==false,b.metadata||{}]);await audit(req.user,'create_test',null,{test_id:q.rows[0].id,title:b.title});res.status(201).json({test:q.rows[0]})}catch(e){res.status(409).json({error:'Could not create test: '+e.message})}});
app.post('/api/admin/import',auth,admin,async(req,res)=>{const data=req.body||{};if(!Array.isArray(data.questions)&&!Array.isArray(data.tests))return res.status(400).json({error:'Send tests/questions/testQuestions arrays'});const client=await pool.connect();let qc=0,tc=0,tqc=0;try{await client.query('BEGIN');for(const t of data.tests||[]){await client.query(`INSERT INTO tests(id,slug,title,institution,category,year,sequence_no,access_type,duration_seconds,published,question_count,metadata) VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,institution=EXCLUDED.institution,category=EXCLUDED.category,year=EXCLUDED.year,sequence_no=EXCLUDED.sequence_no,duration_seconds=EXCLUDED.duration_seconds,published=EXCLUDED.published,metadata=EXCLUDED.metadata,updated_at=NOW()`,[t.id||null,t.slug,t.title,t.institution||null,t.category||null,t.year||null,t.sequence_no||null,t.access_type||'premium',Number(t.duration_seconds||7200),t.published!==false,Number(t.question_count||0),t.metadata||{}]);tc++}for(const q of data.questions||[]){await client.query(`INSERT INTO questions(id,subject,topic,subtopic,year,language,question_en,question_hi,options,answer,explanation_en,explanation_hi,difficulty,source,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO UPDATE SET subject=EXCLUDED.subject,topic=EXCLUDED.topic,subtopic=EXCLUDED.subtopic,year=EXCLUDED.year,language=EXCLUDED.language,question_en=EXCLUDED.question_en,question_hi=EXCLUDED.question_hi,options=EXCLUDED.options,answer=EXCLUDED.answer,explanation_en=EXCLUDED.explanation_en,explanation_hi=EXCLUDED.explanation_hi,difficulty=EXCLUDED.difficulty,source=EXCLUDED.source,metadata=EXCLUDED.metadata,updated_at=NOW()`,[q.id,q.subject||null,q.topic||null,q.subtopic||null,q.year||null,q.language||'bilingual',q.question_en||q.question||'',q.question_hi||null,q.options||[],q.answer??null,q.explanation_en||null,q.explanation_hi||null,q.difficulty||null,q.source||null,q.metadata||{}]);qc++}for(const x of data.testQuestions||[]){await client.query(`INSERT INTO test_questions(test_id,question_id,sort_order) VALUES($1,$2,$3) ON CONFLICT(test_id,question_id) DO UPDATE SET sort_order=EXCLUDED.sort_order`,[x.test_id,x.question_id,Number(x.sort_order||1)]);tqc++}await client.query(`UPDATE tests t SET question_count=(SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id=t.id)`);await client.query('COMMIT');await audit(req.user,'import_content',null,{tests:tc,questions:qc,testQuestions:tqc});res.json({ok:true,tests:tc,questions:qc,testQuestions:tqc})}catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message})}finally{client.release()}});

app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const port=process.env.PORT||3000;
async function initializeDatabase(){
  const schemaPath=path.join(__dirname,'schema.sql');
  const schema=fs.readFileSync(schemaPath,'utf8');
  await pool.query(schema);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
  console.log('Database schema initialized/verified');
}
app.listen(port,async()=>{
  try{
    await initializeDatabase();
    await bootstrapAdmin();
    console.log('DHYEYA running on :'+port);
  }catch(e){
    console.error('Startup initialization failed:',e);
    process.exit(1);
  }
});;
