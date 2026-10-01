import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import path from "path";
import {fileURLToPath} from "url";
import {User, Session, models, COLLECTIONS} from "./models/models.js";

dotenv.config();
const app=express();
const PORT=Number(process.env.PORT||3000);
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const SESSION_DAYS=Number(process.env.SESSION_DAYS||7);
const ADMIN_CODE=String(process.env.ADMIN_VERIFICATION_CODE||"");

app.use(cors());
app.use(express.json({limit:"20mb"}));
app.use(express.text({type:["text/plain","application/json"],limit:"20mb"}));
app.use(rateLimit({windowMs:60*1000,max:240,standardHeaders:true,legacyHeaders:false}));

function jsonBody(req){
  if(req.body && typeof req.body==="object" && !Buffer.isBuffer(req.body)) return req.body;
  if(typeof req.body==="string"){try{return JSON.parse(req.body||"{}")}catch{}}
  return {};
}
function hashToken(v){return crypto.createHash("sha256").update(v).digest("hex");}
function makeSession(){return crypto.randomBytes(32).toString("hex");}
function cleanDoc(d){const o=d.toObject?d.toObject():d; delete o.__v; return o;}
function errMsg(e){return e?.message||String(e);}

const authLimiter=rateLimit({windowMs:15*60*1000,max:80,message:{error:"Too many authentication attempts. Try again later."}});

async function requireSession(req,{admin=false}={}){
  const body=jsonBody(req);
  const token=req.headers.authorization?.replace(/^Bearer\s+/i,"") || body.session || req.query.session;
  if(!token) throw new Error("Login session missing.");
  const s=await Session.findOne({tokenHash:hashToken(token),expiresAt:{$gt:new Date()}}).populate("userId");
  if(!s || !s.userId || !s.userId.active) throw new Error("Session expired. Please login again.");
  if(admin && s.userId.role!=="admin") throw new Error("Admin permission required.");
  req.auth={session:s,user:s.userId,rawToken:token};
  return s.userId;
}

function requireAdminCode(code){
  if(!ADMIN_CODE) throw new Error("ADMIN_VERIFICATION_CODE server par set nahi hai.");
  if(String(code||"")!==ADMIN_CODE) throw new Error("Invalid Admin Verification Code.");
}

async function readAllData(){
  const out={};
  for(const c of COLLECTIONS){
    if(c==="app_settings") continue;
    out[c]=await models[c].find({}).lean();
  }
  // Convert Mongo collection names back to the exact object keys used by the existing HTML.
  const map={
    ohe_masts_down:"OHEMastDown",ohe_masts_up:"OHEMastUp",stations:"Stations",
    curves_ulc:"Curves_ULC",curves_dlc:"Curves_DLC",points:"Points",
    station_meta:"StationMeta",rail_replacements:"RailReplacements",
    curve_reversals:"CurveReversals",gmt_main:"GMT_Main",section_commissions:"SectionCommission",
    crossing_replacements:"CrossingReplacements",switch_replacements:"SwitchReplacements",
    at_welds:"AtWelds",station_platforms:"StationPlatforms",sections_master:"SectionsMaster",
    extra_columns:"ExtraColumns"
  };
  const payload={};
  for(const [c,k] of Object.entries(map)) payload[k]=out[c]||[];
  const settings=await models.app_settings.find({}).lean();
  for(const s of settings) payload[s.key]=s.value;
  const v=await models.app_settings.findOne({key:"version"}).lean();
  payload.gsheetUrl="https://redline-rust-sigma.vercel.app/api";
  payload.gsheetToken="";
  payload._meta={version:v?.value||new Date().toISOString()};
  // Also provide the native DATA keys so the UI's existing applySheetPayload remains usable.
  payload.down=payload.OHEMastDown.map(x=>({id:x.id,ch:x.ch,tc:x.tc}));
  payload.up=payload.OHEMastUp.map(x=>({id:x.id,ch:x.ch,tc:x.tc}));
  payload.stations=payload.Stations.map(x=>({name:x.name,ch:x.ch,type:x.type}));
  payload.ulc=payload.Curves_ULC;
  payload.dlc=payload.Curves_DLC;
  payload.points=payload.Points;
  payload.replacements=payload.RailReplacements;
  payload.reversals=payload.CurveReversals;
  payload.sectionCommissions=payload.SectionCommission;
  payload.crossingReplacements=payload.CrossingReplacements;
  payload.switchReplacements=payload.SwitchReplacements;
  payload.atWelds=payload.AtWelds;
  payload.platforms=payload.StationPlatforms;
  payload.sectionsMaster=payload.SectionsMaster;
  payload.extraColumns=Object.fromEntries((payload.ExtraColumns||[]).map(x=>[x.tableKey,x.columns||[]]));
  const gmts=await models.gmt_main.find({}).lean();
  payload.gmt=gmts.map(x=>({name:x.name,subNames:x.subNames||[],fys:x.fys||[]}));
  payload.stationMeta=Object.fromEntries((payload.StationMeta||[]).map(x=>[x.station,{openingDate:x.openingDate||""}]));
  const meta=await models.app_settings.findOne({key:"meta"}).lean();
  payload.meta=meta?.value||{};
  return payload;
}

async function replaceCollection(modelName,rows){
  if(!Array.isArray(rows)) return;
  const Model=models[modelName];
  if(!Model) return;
  await Model.deleteMany({});
  if(rows.length) await Model.insertMany(rows,{ordered:false});
}
async function saveAll(payload){
  // Accept both the new MongoDB payload keys and the legacy HTML/Sheet-style keys.
  // This keeps Manage Data, MongoDB Fetch, and MongoDB Save on the same data contract.
  const pick = (...keys) => {
    for (const k of keys) if (payload[k] !== undefined) return payload[k];
    return undefined;
  };
  const map={
    down:["ohe_masts_down",v=>(v||[]).map(x=>({id:x.id,ch:x.ch,tc:x.tc||""}))],
    up:["ohe_masts_up",v=>(v||[]).map(x=>({id:x.id,ch:x.ch,tc:x.tc||""}))],
    stations:["stations",v=>(v||[]).map(x=>({name:x.name,ch:x.ch,type:x.type,openingDate:x.openingDate||"",platformLen:x.platformLen===""||x.platformLen==null?undefined:Number(x.platformLen)}))],
    ulc:["curves_ulc",v=>v||[]],
    dlc:["curves_dlc",v=>v||[]],
    points:["points",v=>v||[]],
    replacements:["rail_replacements",v=>v||[]],
    reversals:["curve_reversals",v=>v||[]],
    sectionCommissions:["section_commissions",v=>v||[]],
    crossingReplacements:["crossing_replacements",v=>v||[]],
    switchReplacements:["switch_replacements",v=>v||[]],
    atWelds:["at_welds",v=>v||[]],
    platforms:["station_platforms",v=>v||[]],
    sectionsMaster:["sections_master",v=>v||[]]
  };

  const aliases={
    down:["down","OHEMastDown"], up:["up","OHEMastUp"], stations:["stations","Stations"],
    ulc:["ulc","Curves_ULC"], dlc:["dlc","Curves_DLC"], points:["points","Points"],
    replacements:["replacements","RailReplacements"], reversals:["reversals","CurveReversals"],
    sectionCommissions:["sectionCommissions","SectionCommission"],
    crossingReplacements:["crossingReplacements","CrossingReplacements"],
    switchReplacements:["switchReplacements","SwitchReplacements"],
    atWelds:["atWelds","AtWelds"], platforms:["platforms","StationPlatforms"],
    sectionsMaster:["sectionsMaster","SectionsMaster"]
  };

  for(const [key,[model,fn]] of Object.entries(map)) {
    const rows=pick(...aliases[key]);
    if(rows!==undefined) await replaceCollection(model,fn(rows));
  }

  // Keep the legacy platformLen object in sync with station records sent by Manage Data.
  const stationRows=pick("stations","Stations");
  if(stationRows!==undefined) {
    const platformMap={};
    for(const st of (stationRows||[])) {
      const n=st.platformLen===""||st.platformLen==null?null:Number(st.platformLen);
      if(st.name && n!=null && Number.isFinite(n)) platformMap[st.name]=n;
    }
    await models.app_settings.updateOne({key:"platformLen"},{$set:{value:platformMap}},{upsert:true});
  }

  // GMT can arrive either as nested DATA.gmt or as the two flat tables used by the HTML.
  if(pick("gmt")!==undefined) {
    await replaceCollection("gmt_main",(pick("gmt")||[]).map(x=>({name:x.name,subNames:x.subNames||[],fys:x.fys||[]})));
  } else if(pick("GMT_FY","GMT_Sub")!==undefined) {
    const mains={};
    for(const r of (pick("GMT_Sub")||[])) {
      const name=String(r.mainSection||"").trim(); if(!name) continue;
      mains[name]=mains[name]||{name,subNames:[],fys:[]};
      const sn=String(r.subName||"").trim(); if(sn && !mains[name].subNames.includes(sn)) mains[name].subNames.push(sn);
    }
    for(const r of (pick("GMT_FY")||[])) {
      const name=String(r.mainSection||"").trim(); if(!name) continue;
      mains[name]=mains[name]||{name,subNames:[],fys:[]};
      mains[name].fys.push({fy:r.fy||"",gmt:r.gmt===""||r.gmt==null?null:Number(r.gmt),start:r.start||"",end:r.end||""});
    }
    await replaceCollection("gmt_main",Object.values(mains));
  }

  const stationMeta=pick("stationMeta","StationMeta");
  if(stationMeta!==undefined) {
    await replaceCollection("station_meta",Object.entries(stationMeta||{}).map(([station,v])=>({station,openingDate:v?.openingDate||""})));
  }
  const extraColumns=pick("extraColumns","ExtraColumns");
  if(extraColumns!==undefined) {
    const rows=Array.isArray(extraColumns)
      ? extraColumns
      : Object.entries(extraColumns||{}).map(([tableKey,columns])=>({tableKey,columns:columns||[]}));
    await replaceCollection("extra_columns",rows);
  }

  // Platform length is stored with each station as well as in app_settings for compatibility.
  const platformLen=pick("platformLen","PlatformLen");
  if(platformLen!==undefined) await models.app_settings.updateOne({key:"platformLen"},{$set:{value:platformLen}},{upsert:true});
  const meta=pick("meta","Meta");
  if(meta!==undefined) await models.app_settings.updateOne({key:"meta"},{$set:{value:meta}},{upsert:true});

  await models.app_settings.updateOne({key:"gsheetUrl"},{$set:{value:"https://redline-rust-sigma.vercel.app/api"}},{upsert:true});
  await models.app_settings.updateOne({key:"version"},{$set:{value:new Date().toISOString()}},{upsert:true});
  return readAllData();
}

app.get("/health",(req,res)=>res.json({ok:true,service:"OHE Track MongoDB Backend",time:new Date().toISOString()}));
app.get("/api/data",async(req,res)=>{
  try{await requireSession(req); res.json(await readAllData())}catch(e){res.status(401).json({error:errMsg(e)})}
});
app.get("/api/data/version",async(req,res)=>{try{await requireSession(req);const v=await models.app_settings.findOne({key:"version"}).lean();res.json({version:v?.value||""})}catch(e){res.status(401).json({error:errMsg(e)})}});

// CRUD endpoints for future direct MongoDB use.
app.get("/api/collection/:collection",async(req,res)=>{try{await requireSession(req);const M=models[req.params.collection];if(!M)return res.status(404).json({error:"Unknown collection"});res.json(await M.find({}).lean())}catch(e){res.status(401).json({error:errMsg(e)})}});
app.post("/api/collection/:collection",async(req,res)=>{try{await requireSession(req,{admin:true});const M=models[req.params.collection];if(!M)return res.status(404).json({error:"Unknown collection"});const d=await M.create(jsonBody(req));res.status(201).json(cleanDoc(d))}catch(e){res.status(400).json({error:errMsg(e)})}});
app.put("/api/collection/:collection/:id",async(req,res)=>{try{await requireSession(req,{admin:true});const M=models[req.params.collection];if(!M)return res.status(404).json({error:"Unknown collection"});const d=await M.findByIdAndUpdate(req.params.id,jsonBody(req),{new:true,runValidators:true});if(!d)return res.status(404).json({error:"Record not found"});res.json(cleanDoc(d))}catch(e){res.status(400).json({error:errMsg(e)})}});
app.delete("/api/collection/:collection/:id",async(req,res)=>{try{await requireSession(req,{admin:true});const M=models[req.params.collection];if(!M)return res.status(404).json({error:"Unknown collection"});await M.findByIdAndDelete(req.params.id);res.json({ok:true})}catch(e){res.status(400).json({error:errMsg(e)})}});

async function authAction(action,p){
  if(action==="initializeAdmin"){
    requireAdminCode(p.adminCode);
    if(await User.exists({role:"admin"})) throw new Error("Admin already exists. Use normal Admin signup/reset.");
    const u=await User.create({name:p.name,username:p.username.toLowerCase(),passwordHash:await bcrypt.hash(p.password,12),role:"admin",securityQuestion:p.secQ||"Admin",securityAnswerHash:await bcrypt.hash(String(p.secA||p.username),12)});
    return {message:"Initial Admin ban gaya. Ab Login karein.",username:u.username};
  }
  if(action==="login"){
    const u=await User.findOne({username:String(p.username||"").toLowerCase()});
    if(!u || !u.active || !(await bcrypt.compare(String(p.password||""),u.passwordHash))) throw new Error("Invalid username or password.");
    const token=makeSession();
    await Session.create({tokenHash:hashToken(token),userId:u._id,expiresAt:new Date(Date.now()+SESSION_DAYS*86400000)});
    return {session:token,username:u.username,name:u.name,role:u.role};
  }
  if(action==="createUser"){
    if(p.role==="admin") requireAdminCode(p.adminCode);
    const username=String(p.username||"").trim().toLowerCase();
    if(!username || !p.name || !p.password) throw new Error("Name, username and password are required.");
    if(await User.exists({username})) throw new Error("Username already exists.");
    const u=await User.create({name:p.name,username,passwordHash:await bcrypt.hash(p.password,12),role:p.role==="admin"?"admin":"user",securityQuestion:p.secQ||"",securityAnswerHash:await bcrypt.hash(String(p.secA||""),12)});
    return {message:"Account ban gaya. Ab Login karein.",username:u.username};
  }
  if(action==="findUser"){
    const u=await User.findOne({username:String(p.username||"").toLowerCase()});
    if(!u) throw new Error("User nahi mila.");
    return {username:u.username,role:u.role,securityQuestion:u.securityQuestion};
  }
  if(action==="resetPassword"){
    const u=await User.findOne({username:String(p.username||"").toLowerCase()});
    if(!u) throw new Error("User nahi mila.");
    if(u.role==="admin") requireAdminCode(p.adminCode);
    else if(!(await bcrypt.compare(String(p.securityAnswer||""),u.securityAnswerHash))) throw new Error("Security answer galat hai.");
    u.passwordHash=await bcrypt.hash(p.newPassword,12); await u.save();
    await Session.deleteMany({userId:u._id});
    return {message:"Password reset ho gaya. Ab Login karein."};
  }
  if(action==="logout"){
    if(p.session) await Session.deleteOne({tokenHash:hashToken(p.session)});
    return {ok:true};
  }
  throw new Error("Unknown action.");
}

app.post("/api",authLimiter,async(req,res)=>{
  try{
    const p=jsonBody(req), action=p.action;
    if(["login","createUser","findUser","resetPassword","initializeAdmin","logout"].includes(action)){
      return res.json(await authAction(action,p));
    }
    if(action==="write"){
      await requireSession(req,{admin:true});
      const payload={...p}; delete payload.action; delete payload.session;
      const saved=await saveAll(payload);
      return res.json({ok:true,message:"MongoDB save complete.",version:saved._meta.version});
    }
    return res.status(400).json({error:"Unknown action."});
  }catch(e){res.status(400).json({error:errMsg(e)})}
});

// Compatibility GET used by the existing HTML's fetchFromSheet().
app.get("/api",async(req,res)=>{
  try{
    if(req.query.mode==="version"){await requireSession(req);const v=await models.app_settings.findOne({key:"version"}).lean();return res.json({version:v?.value||""});}
    await requireSession(req);
    res.json(await readAllData());
  }catch(e){res.status(401).json({error:errMsg(e)})}
});

app.use(express.static(__dirname+"/public"));
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).then(async()=>{
    console.log("MongoDB connected:",mongoose.connection.name);
  }).catch(e=>{console.error("MongoDB connection failed:",e);});
}

if (process.env.NODE_ENV !== "production" || process.env.VERCEL !== "1") {
  app.listen(PORT,()=>console.log(`OHE Track server: http://localhost:${PORT}`));
}

export default app;
