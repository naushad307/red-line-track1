import mongoose from "mongoose";

const loose = { type: mongoose.Schema.Types.Mixed, default: undefined };

const userSchema = new mongoose.Schema({
  name: {type:String, required:true, trim:true},
  username: {type:String, required:true, unique:true, index:true, lowercase:true, trim:true},
  passwordHash: {type:String, required:true},
  role: {type:String, enum:["user","admin"], default:"user", index:true},
  securityQuestion: {type:String, default:""},
  securityAnswerHash: {type:String, default:""},
  active: {type:Boolean, default:true},
  createdAt: {type:Date, default:Date.now},
  updatedAt: {type:Date, default:Date.now}
},{timestamps:false});

const sessionSchema = new mongoose.Schema({
  tokenHash:{type:String,required:true,unique:true,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  expiresAt:{type:Date,required:true,index:true}
},{timestamps:true});

const schemas = {
  ohe_masts_down:{line:String,id:String,ch:Number,tc:String,extra:loose},
  ohe_masts_up:{line:String,id:String,ch:Number,tc:String,extra:loose},
  stations:{name:{type:String,index:true},ch:{type:Number,index:true},type:String,openingDate:String,platformLen:Number,extra:loose},
  curves_ulc:{curveNo:String,section:String,ST:String,TC:String,CT:String,TS:String,mastFrom:String,mastTo:String,radius:Number,transitionLen:Number,circularLen:Number,totalLen:Number,cant:Number,type:String,degree:Number,fastening:String,fittingYear:String,maxSpeed:Number,stationMark:String,centerChainage:Number,extra:loose},
  curves_dlc:{curveNo:String,section:String,ST:String,TC:String,CT:String,TS:String,mastFrom:String,mastTo:String,radius:Number,transitionLen:Number,circularLen:Number,totalLen:Number,cant:Number,type:String,degree:Number,fastening:String,fittingYear:String,maxSpeed:Number,stationMark:String,centerChainage:Number,extra:loose},
  points:{sr:String,pointNo:{type:String,index:true},line:String,station:String,ohe:String,ch:Number,angle:String,hand:String,dateLaying:String,extra:loose},
  station_meta:{station:{type:String,unique:true,index:true},openingDate:String},
  rail_replacements:{dateOfReplacement:String,section:String,line:String,rail:String,chFrom:Number,chTo:Number,oheFrom:String,oheTo:String,length:Number,reason:String,rollingMarkOld:String,rollingMarkNew:String,extra:loose},
  curve_reversals:{dateOfReversal:String,section:String,curveNo:String,line:String,chFrom:Number,chTo:Number,oheFrom:String,oheTo:String,length:Number,reason:String,extra:loose},
  gmt_main:{name:{type:String,index:true},subNames:[String],fys:[loose]},
  section_commissions:{sectionFrom:String,sectionTo:String,commissionDate:String,extra:loose},
  crossing_replacements:{pointNo:String,line:String,station:String,ohe:String,ch:Number,angle:String,hand:String,dateOfLaying:String,dateOfReplacement:String,extra:loose},
  switch_replacements:{pointNo:String,section:String,manufacturer:String,drawingNo:String,hand:String,dateOfLaying:String,dateOfReplacement:String,remarks:String,extra:loose},
  at_welds:{sr:String,section:String,oheFrom:String,oheTo:String,chainageNo:String,weldId:{type:String,index:true},dateAT:String,line:String,railTurnout:String,turnoutNo:String,weldOn:String,weldType:String,portionMake:String,executedBy:String,dateUSFD:String,usfdResult:String,usfd0Head:String,usfd70Head:String,usfd70Foot:String,usfd45HalfMoon:String,usfd45Tandem:String,status:String,replacedDate:String,failureReason:String,noNewWeld:String,newWeldId:String,oldRollingMark:String,newRollingMark:String,remarks:String,extra:loose},
  station_platforms:{station:String,line:String,oheMastFrom:String,oheMastTo:String,chFrom:Number,chTo:Number,length:Number,centreChainage:Number,extra:loose},
  sections_master:{sectionFrom:String,sectionTo:String,section:{type:String,index:true},extra:loose},
  extra_columns:{tableKey:{type:String,unique:true,index:true},columns:[String]},
  app_settings:{key:{type:String,unique:true,index:true},value:loose}
};

export const User = mongoose.model("User", userSchema);
export const Session = mongoose.model("Session", sessionSchema);
export const models = Object.fromEntries(Object.entries(schemas).map(([name,def])=>[
  name, mongoose.model(name.replace(/(^|_)(\w)/g,(_,a,b)=>b.toUpperCase()), new mongoose.Schema(def,{timestamps:true, collection:name, strict:false}))
]));
export const COLLECTIONS=Object.keys(schemas);
