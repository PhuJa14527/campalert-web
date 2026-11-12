import { readFile } from "node:fs/promises";
import { SlashCommandBuilder } from "discord.js";

const CAMPS_FILE = new URL("../data/camps.json", import.meta.url);

export async function campFieldChoices() {
  const raw = JSON.parse(await readFile(CAMPS_FILE, "utf8"));
  const fields = [...new Set(raw.camps.map((camp) => camp.field))].filter(
    (field) => field !== "ทั่วไป",
  );
  return [{ name: "ทุกสาย", value: "ทั้งหมด" }].concat(
    fields.slice(0, 24).map((field) => ({ name: field, value: field })),
  );
}

export async function buildCommands() {
  const fields = await campFieldChoices();

  return [
    new SlashCommandBuilder()
      .setName("notify")
      .setDescription("ตั้งค่าการแจ้งเตือนค่าย")
      .addStringOption((option) =>
        option
          .setName("mode")
          .setDescription("อยากให้แจ้งเรื่องอะไร")
          .setRequired(true)
          .addChoices(
            { name: "ค่ายใหม่", value: "new" },
            { name: "ใกล้ปิดรับสมัคร", value: "deadline" },
            { name: "ทั้งสองอย่าง", value: "both" },
          ),
      )
      .addStringOption((option) =>
        option
          .setName("field")
          .setDescription("สนใจสายค่ายไหน (ไม่เลือก = ทุกสาย)")
          .addChoices(...fields),
      )
      .addIntegerOption((option) =>
        option
          .setName("advance")
          .setDescription("แจ้งล่วงหน้ากี่วันก่อนปิดรับ (1-14, ค่าเริ่มต้น 3)")
          .setMinValue(1)
          .setMaxValue(14),
      ),
    new SlashCommandBuilder()
      .setName("settings")
      .setDescription("ดูการตั้งค่าการแจ้งเตือนของฉัน"),
    new SlashCommandBuilder()
      .setName("stop")
      .setDescription("ปิดการแจ้งเตือนทั้งหมดของฉัน"),
  ].map((command) => command.toJSON());
}
