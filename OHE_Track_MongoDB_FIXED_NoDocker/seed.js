import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import {models} from "./models/models.js";

dotenv.config();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(__dirname,"data");
const files={
ohe_masts_down:"ohe_masts_down.json",ohe_masts_up:"ohe_masts_up.json",stations:"stations.json",
curves_ulc:"curves_ulc.json",curves_dlc:"curves_dlc.json",points:"points.json",station_meta:"station_meta.json",
rail_replacements:"rail_replacements.json",curve_reversals:"curve_reversals.json",gmt_main:"gmt_main.json",
section_commissions:"section_commissions.json",crossing_replacements:"crossing_replacements.json",
switch_replacements:"switch_replacements.json",at_welds:"at_welds.json",station_platforms:"station_platforms.json",
sections_master:"sections_master.json",extra_columns:"extra_columns.json",app_settings:"app_settings.json"
};
await mongoose.connect(process.env.MONGODB_URI);
for(const [name,file] of Object.entries(files)){
  const rows=JSON.parse(fs.readFileSync(path.join(dataDir,file),"utf8"));
  const M=models[name];
  await M.deleteMany({});
  if(rows.length) await M.insertMany(rows,{ordered:false});
  console.log(`${name}: ${rows.length}`);
}
await models.app_settings.updateOne({key:"version"},{$set:{value:new Date().toISOString()}},{upsert:true});
console.log("Seed complete.");
await mongoose.disconnect();
