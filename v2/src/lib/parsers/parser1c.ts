import { ParsedTransaction } from "./types";

// Windows-1251 code points for bytes 0x80–0xFF
const CP1251_MAP = [
  0x0402,0x0403,0x201A,0x0453,0x201E,0x2026,0x2020,0x2021,
  0x20AC,0x2030,0x0409,0x2039,0x040A,0x040C,0x040B,0x040F,
  0x0452,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,
  0x003F,0x2122,0x0459,0x203A,0x045A,0x045C,0x045B,0x045F,
  0x00A0,0x040E,0x045E,0x0408,0x00A4,0x0490,0x00A6,0x00A7,
  0x0401,0x00A9,0x0404,0x00AB,0x00AC,0x00AD,0x00AE,0x0407,
  0x00B0,0x00B1,0x0406,0x0456,0x0491,0x00B5,0x00B6,0x00B7,
  0x0451,0x2116,0x0454,0x00BB,0x0458,0x0405,0x0455,0x0457,
  // 0xC0–0xCF: А–П
  0x0410,0x0411,0x0412,0x0413,0x0414,0x0415,0x0416,0x0417,
  0x0418,0x0419,0x041A,0x041B,0x041C,0x041D,0x041E,0x041F,
  // 0xD0–0xDF: Р–Я
  0x0420,0x0421,0x0422,0x0423,0x0424,0x0425,0x0426,0x0427,
  0x0428,0x0429,0x042A,0x042B,0x042C,0x042D,0x042E,0x042F,
  // 0xE0–0xEF: а–п
  0x0430,0x0431,0x0432,0x0433,0x0434,0x0435,0x0436,0x0437,
  0x0438,0x0439,0x043A,0x043B,0x043C,0x043D,0x043E,0x043F,
  // 0xF0–0xFF: р–я
  0x0440,0x0441,0x0442,0x0443,0x0444,0x0445,0x0446,0x0447,
  0x0448,0x0449,0x044A,0x044B,0x044C,0x044D,0x044E,0x044F,
];

function decodeCP1251(buf: Buffer): string {
  const chars: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    chars.push(b < 0x80 ? String.fromCharCode(b) : String.fromCharCode(CP1251_MAP[b - 0x80] ?? b));
  }
  return chars.join("");
}

/**
 * Parses a 1CClientBankExchange file (Windows-1251 encoded).
 *
 * Direction is resolved by comparing the account numbers:
 *   - header РасчСчет = our account
 *   - if ПолучательРасчСчет == ourAccount → CREDIT (money came in)
 *   - otherwise → DEBIT (money went out)
 *
 * Counterparty:
 *   - CREDIT: payer (Плательщик / ПлательщикИНН)
 *   - DEBIT:  recipient (Получатель / ПолучательИНН)
 */
export function parse1CExchange(input: string | Buffer): ParsedTransaction[] {
  const text = Buffer.isBuffer(input) ? decodeCP1251(input) : input;
  const lines = text.split(/\r?\n/);
  const transactions: ParsedTransaction[] = [];

  // Extract our account from the top-level header (first РасчСчет before any section)
  let ourAccount = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("СекцияРасчСчет") || trimmed.startsWith("СекцияДокумент")) break;
    if (trimmed.startsWith("РасчСчет=")) {
      ourAccount = trimmed.slice("РасчСчет=".length).trim();
      break;
    }
  }

  let current: Record<string, string> = {};
  let inSection = false;

  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      const k = line.trim();
      if (k === "КонецДокумента" && inSection) {
        inSection = false;

        const amount = parseFloat((current["Сумма"] || "0").replace(",", "."));
        const dateStr = current["Дата"] || "";
        const parts = dateStr.split(".");
        if (parts.length !== 3 || amount <= 0) continue;

        const [day, month, year] = parts;
        const date = new Date(`${year}-${month}-${day}`);
        if (isNaN(date.getTime())) continue;

        // Determine direction via account comparison
        const recipientAccount = current["ПолучательРасчСчет"] || current["ПолучательСчет"] || "";
        const isCredit = ourAccount
          ? recipientAccount === ourAccount
          : recipientAccount !== "" && recipientAccount !== (current["ПлательщикРасчСчет"] || current["ПлательщикСчет"] || "");

        const direction: "CREDIT" | "DEBIT" = isCredit ? "CREDIT" : "DEBIT";

        let counterpartyHint: string | undefined;
        let counterpartyInn: string | undefined;

        if (isCredit) {
          // Money came from payer
          counterpartyHint = current["Плательщик"] || undefined;
          counterpartyInn = current["ПлательщикИНН"] || undefined;
        } else {
          // Money went to recipient
          counterpartyHint = current["Получатель"] || undefined;
          counterpartyInn = current["ПолучательИНН"] || undefined;
        }

        // Strip "ИНН 123456789 " prefix that some banks include in the name field
        if (counterpartyHint) {
          counterpartyHint = counterpartyHint.replace(/^ИНН\s+\d+\s+/i, "").trim() || undefined;
        }
        // Normalise INN: digits only, skip all-zeros placeholder
        if (counterpartyInn) {
          counterpartyInn = counterpartyInn.replace(/\D/g, "");
          if (/^0+$/.test(counterpartyInn)) counterpartyInn = undefined;
        }

        transactions.push({
          date,
          amount,
          direction,
          description: current["НазначениеПлатежа"] || current["Назначение"] || "",
          counterpartyHint: counterpartyHint || undefined,
          counterpartyInn: counterpartyInn || undefined,
        });

        current = {};
      }
      continue;
    }

    const k = line.slice(0, eqIdx).trim();
    const v = line.slice(eqIdx + 1).trim();

    if (k === "СекцияДокумент") {
      inSection = true;
      current = {};
    } else if (inSection) {
      current[k] = v;
    }
  }

  return transactions;
}
