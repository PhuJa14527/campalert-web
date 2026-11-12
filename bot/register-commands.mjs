import { REST, Routes } from "discord.js";
import { buildCommands } from "./commands.mjs";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error(
    "ยังไม่ได้ใส่ DISCORD_BOT_TOKEN หรือ DISCORD_CLIENT_ID ใน .env.local (ดูวิธีใน build-plan.md)",
  );
  process.exit(1);
}

const rest = new REST().setToken(token);
const commands = await buildCommands();

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`ลงทะเบียน ${commands.length} คำสั่งในเซิร์ฟเวอร์ ${guildId} แล้ว`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(
      `ลงทะเบียน ${commands.length} คำสั่งแบบทั้งแอปแล้ว (อาจใช้เวลาถึง 1 ชั่วโมงกว่าจะเห็น)`,
    );
  }
} catch (error) {
  console.error("ลงทะเบียนไม่สำเร็จ:", error);
  process.exit(1);
}
