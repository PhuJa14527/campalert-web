import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { spawn } from "node:child_process";
import {
  deadlineCamps,
  loadCamps,
  matchesField,
  messageBody,
  newCamps,
  notificationKey,
  todayISO,
} from "./notify.mjs";
import { deleteDbUser, loadDbUsers, saveDbUser } from "./db.mjs";
import {
  getUserSettings,
  loadSettings,
  loadSnapshot,
  removeUser,
  saveSettings,
  saveSnapshot,
  upsertUser,
} from "./store.mjs";

const CHECK_EVERY_MS = 30 * 60 * 1000;
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS ?? 24);
const DRY_RUN = process.argv.includes("--dry-run");

const modeLabel = { new: "ค่ายใหม่", deadline: "ใกล้ปิดรับสมัคร", both: "ค่ายใหม่ + ใกล้ปิดรับสมัคร" };

function summary(settings) {
  return [
    `โหมด: ${modeLabel[settings.mode] ?? settings.mode}`,
    `สายที่สนใจ: ${settings.field ?? "ทั้งหมด"}`,
    `แจ้งล่วงหน้า: ${settings.advance ?? 3} วันก่อนปิดรับ`,
  ].join("\n");
}

async function refreshData() {
  if (REFRESH_HOURS <= 0) return;
  await new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/fetch-camphub.mjs"], {
      stdio: "ignore",
    });
    child.on("exit", resolve);
    child.on("error", resolve);
  });
}

// รวมค่ายที่จะต้องแจ้งให้ผู้ใช้คนหนึ่ง ณ รอบนี้
function pendingFor(settings, camps, newbieIds, today) {
  const sent = settings.sent ?? {};
  const pending = [];

  if (settings.mode === "new" || settings.mode === "both") {
    for (const camp of camps) {
      if (!newbieIds.has(camp.id)) continue;
      if (!matchesField(camp, settings.field)) continue;
      const key = notificationKey(camp.id, "new");
      if (sent[key]) continue;
      pending.push({ camp, reason: "new", advance: 0, key });
    }
  }

  if (settings.mode === "deadline" || settings.mode === "both") {
    const advance = settings.advance ?? 3;
    for (const camp of deadlineCamps(camps, advance, today)) {
      if (!matchesField(camp, settings.field)) continue;
      const key = notificationKey(camp.id, "deadline");
      if (sent[key]) continue;
      pending.push({ camp, reason: "deadline", advance, key });
    }
  }

  return pending;
}

function pruneSent(sent, camps) {
  const ids = new Set(camps.map((camp) => camp.id));
  const next = {};
  for (const [key, value] of Object.entries(sent ?? {})) {
    if (ids.has(key.split(":")[0])) next[key] = value;
  }
  return next;
}

let client = null;

async function runNotifications() {
  const camps = await loadCamps();
  const snapshot = await loadSnapshot();
  const firstRun = !Array.isArray(snapshot.knownIds);
  const newbieIds = new Set(newCamps(camps, snapshot.knownIds ?? []).map((camp) => camp.id));

  await saveSnapshot({ knownIds: camps.map((camp) => camp.id), updatedAt: new Date().toISOString() });

  if (firstRun) {
    console.log(`รอบแรก: จำค่าย ${camps.length} รายการไว้เป็นฐาน ไม่แจ้งย้อนหลัง`);
    return;
  }

  const settings = await loadSettings();
  const users = await usersWithDb(settings);
  const today = todayISO();

  for (const [userId, user] of Object.entries(users)) {
    const pending = pendingFor(user, camps, newbieIds, today);
    if (pending.length === 0) continue;

    for (const item of pending) {
      const text = messageBody(item.camp, item.reason, item.advance);
      try {
        const discordUser = await client.users.fetch(userId);
        await discordUser.send({ content: text });
        user.sent = { ...(user.sent ?? {}), [item.key]: new Date().toISOString() };
        console.log(`แจ้ง ${userId}: ${item.camp.title} (${item.reason})`);
      } catch (error) {
        console.log(`ส่ง DM ให้ ${userId} ไม่ได้: ${error.message}`);
      }
    }

    user.sent = pruneSent(user.sent, camps);
    // เก็บสถานะ "แจ้งไปแล้ว" ไว้ในเครื่อง ส่วนค่าตั้งอ่านจากฐานข้อมูลทุกครั้ง
    settings.users[userId] = { ...(settings.users[userId] ?? {}), sent: user.sent };
    await saveSettings(settings);
  }
}

// รวมการตั้งค่าจากฐานข้อมูล (ตั้งบนเว็บ) ทับค่าที่ตั้งผ่านคำสั่ง Discord
async function usersWithDb(settings) {
  const users = { ...settings.users };
  try {
    const dbUsers = await loadDbUsers();
    for (const [discordId, config] of Object.entries(dbUsers)) {
      users[discordId] = {
        ...(users[discordId] ?? {}),
        ...config,
        sent: users[discordId]?.sent ?? {},
      };
    }
  } catch (error) {
    console.log("อ่านการตั้งค่าจากฐานข้อมูลไม่ได้ ใช้ค่าในเครื่องแทน:", error.message);
  }
  return users;
}

async function startScheduler() {
  await runNotifications().catch((error) => console.log("ตรวจรอบแรกไม่สำเร็จ:", error.message));
  setInterval(() => {
    runNotifications().catch((error) => console.log("ตรวจรอบถัดไปไม่สำเร็จ:", error.message));
  }, CHECK_EVERY_MS).unref();

  if (REFRESH_HOURS > 0) {
    setInterval(() => {
      refreshData().catch(() => {});
    }, REFRESH_HOURS * 60 * 60 * 1000).unref();
  }
}

async function handleCommand(interaction) {
  const settings = await loadSettings();

  if (interaction.commandName === "notify") {
    const mode = interaction.options.getString("mode", true);
    const field = interaction.options.getString("field") ?? "ทั้งหมด";
    const advance = interaction.options.getInteger("advance") ?? 3;

    // ถ้าผู้ใช้เคยล็อกอินเว็บไว้ เก็บลงฐานข้อมูลเพื่อให้เว็บเห็นค่าเดียวกัน
    const savedToDb = await saveDbUser(interaction.user.id, { mode, field, advance }).catch(
      () => false,
    );

    const user = savedToDb
      ? { mode, field, advance }
      : await upsertUser(settings, interaction.user.id, {
          mode,
          field,
          advance,
          name: interaction.user.username,
          sent: settings.users[interaction.user.id]?.sent ?? {},
        });

    let dmNote = "\n\nส่งข้อความทดสอบไปใน DM แล้ว";
    try {
      await interaction.user.send({
        content: `ตั้งค่าการแจ้งเตือน CampAlert แล้ว ✅\n${summary(user)}\n\nข้อความนี้คือตัวอย่าง ว่ารูปแบบการแจ้งเตือนหน้าตาเป็นแบบไหน`,
      });
    } catch {
      dmNote =
        "\n\n⚠️ ส่ง DM ไม่ได้ ลองเปิด Privacy Settings → Direct Messages ของเซิร์ฟเวอร์นี้ให้อนุญาต";
    }

    await interaction.reply({
      content: `ตั้งค่าแล้ว ✅\n${summary(user)}${dmNote}${
        savedToDb ? "\n\n(บันทึกในบัญชีเว็บแล้ว ดูได้ที่หน้า ตั้งค่าการแจ้งเตือน)" : ""
      }`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === "settings") {
    const dbUsers = await loadDbUsers().catch(() => ({}));
    const user = dbUsers[interaction.user.id] ?? getUserSettings(settings, interaction.user.id);
    await interaction.reply({
      content: user
        ? `การตั้งค่าของคุณ\n${summary(user)}`
        : "ยังไม่ได้ตั้งค่า พิมพ์ /notify เพื่อเลือกว่าจะให้แจ้งเรื่องอะไร",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === "stop") {
    await deleteDbUser(interaction.user.id).catch(() => false);
    await removeUser(settings, interaction.user.id);
    await interaction.reply({
      content: "ปิดการแจ้งเตือนทั้งหมดแล้ว พิมพ์ /notify เมื่ออยากเปิดอีกครั้ง",
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (DRY_RUN) {
    const camps = await loadCamps();
    const today = todayISO();
    console.log(`ทดลองโหมดไม่ส่งจริง · ค่าย ${camps.length} รายการ · วันนี้ ${today}`);
    for (const camp of deadlineCamps(camps, 7, today)) {
      console.log("\n--- ใกล้ปิดรับ (7 วัน) ---");
      console.log(messageBody(camp, "deadline", 7));
    }
    console.log("\n--- ตัวอย่างค่ายใหม่ ---");
    console.log(messageBody(camps[camps.length - 1], "new", 0));
    return;
  }

  if (!token) {
    console.error(
      "ยังไม่ได้ใส่ DISCORD_BOT_TOKEN ใน .env.local\nสร้างบอทที่ https://discord.com/developers/applications แล้วคัดลอก token มาใส่เอง",
    );
    process.exit(1);
  }

  client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`บอทออนไลน์แล้ว: ${readyClient.user.tag}`);
    startScheduler();
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    handleCommand(interaction).catch((error) => {
      console.log("จัดการคำสั่งไม่สำเร็จ:", error.message);
      if (interaction.isRepliable() && !interaction.replied) {
        interaction
          .reply({ content: "เกิดข้อผิดพลาด ลองอีกครั้ง", flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    });
  });

  await client.login(token);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
