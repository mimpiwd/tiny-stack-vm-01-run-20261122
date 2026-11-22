import * as fs from "node:fs";
import * as path from "node:path";
// Tiny stack VM (make.fun tiny-stack-vm-01 ISA). Usage: node main.ts [in] [out]
const I = process.argv[2] || "/input", O = process.argv[3] || "/output";
// Signed 16-bit little-endian immediate (jump offsets).
function s16(p: Buffer, at: number) {
  const v = p[at] | (p[at + 1] << 8);
  return v & 32768 ? v - 65536 : v;
}
function run(p: Buffer, d: Buffer) {
  const s: number[] = [], c: number[] = [], m = new Int32Array(256), o: number[] = [];
  const n = p.length;
  let pc = 0, ip = 0, k = 0, x = 0, sp = 0;
  run: while (true) {
    if (k >= 1e6) { x = 10; break; }
    if (pc < 0 || pc >= n) { x = 9; break; }
    const op = p[pc];
    if (!(op <= 7 || (op >= 16 && op <= 34) || (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83))) { x = 5; break; }
    let im = 0;
    if (op === 1) im = 1;
    else if (op === 2) im = 4;
    else if (op >= 48 && op <= 51) im = 2;
    if (pc + 1 + im > n) { x = 9; break; }
    let pp = 0, pu = 0;
    if (op === 1 || op === 2 || op === 82) pu = 1;
    else if (op === 3) pp = 1;
    else if (op === 4) { pp = 1; pu = 2; }
    else if (op === 5) { pp = 2; pu = 2; }
    else if (op === 6) { pp = 2; pu = 3; }
    else if (op === 7) { pp = 3; pu = 3; }
    else if (op >= 16 && op <= 34 && op !== 23 && op !== 27) { pp = 2; pu = 1; }
    else if (op === 23 || op === 27) { pp = 1; pu = 1; }
    else if (op === 49 || op === 50) pp = 1;
    else if (op === 64) { pp = 1; pu = 1; }
    else if (op === 65) pp = 2;
    else if (op === 80 || op === 81 || op === 83) pp = 1;
    if (sp < pp) { x = 2; break; }
    if (sp - pp + pu > 256) { x = 3; break; }
    k++;
    let np = pc + 1 + im;
    if (op >= 16 && op <= 34 && op !== 23 && op !== 27) {
      const b = s[--sp], a = s[--sp];
      let r = 0;
      if (op === 16) r = (a + b) | 0;
      else if (op === 17) r = (a - b) | 0;
      else if (op === 18) r = Math.imul(a, b);
      else if (op === 19) { if (!b) { x = 4; break run; } r = (a / b) | 0; }
      else if (op === 20) { if (!b) { x = 4; break run; } r = (a % b) | 0; }
      else if (op === 21) { if (!b) { x = 4; break run; } r = ((a >>> 0) / (b >>> 0)) | 0; }
      else if (op === 22) { if (!b) { x = 4; break run; } r = ((a >>> 0) % (b >>> 0)) | 0; }
      else if (op === 24) r = a & b;
      else if (op === 25) r = a | b;
      else if (op === 26) r = a ^ b;
      else if (op === 28) r = a << (b & 31);
      else if (op === 29) r = a >> (b & 31);
      else if (op === 30) r = (a >>> (b & 31)) | 0;
      else if (op === 32) r = a === b ? 1 : 0;
      else if (op === 33) r = a < b ? 1 : 0;
      else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
      s[sp++] = r;
      pc = np;
      continue;
    }
    switch (op) {
      case 0: x = 0; break run;
      case 1: { let v = p[pc + 1]; if (v & 128) v -= 256; s[sp++] = v; break; }
      case 2: s[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24); break;
      case 3: sp--; break;
      case 4: { const t = s[sp - 1]; s[sp++] = t; break; }
      case 5: { const t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; break; }
      case 6: { const t = s[sp - 2]; s[sp++] = t; break; }
      case 7: { const a = s[sp - 3], b = s[sp - 2], cc = s[sp - 1]; s[sp - 3] = b; s[sp - 2] = cc; s[sp - 1] = a; break; }
      case 23: s[sp - 1] = (-s[sp - 1]) | 0; break;
      case 27: s[sp - 1] = ~s[sp - 1]; break;
      case 48: case 49: case 50: {
        const off = s16(p, pc + 1);
        if (op === 48 || (op === 49 && s[--sp] === 0) || (op === 50 && s[--sp] !== 0)) np += off;
        break;
      }
      case 51: {
        if (c.length >= 64) { x = 7; break run; }
        c.push(np);
        np = p[pc + 1] | (p[pc + 2] << 8);
        break;
      }
      case 52: {
        if (!c.length) { x = 8; break run; }
        np = c.pop()!;
        break;
      }
      case 64: {
        const a = s[--sp];
        if (a < 0 || a > 255) { x = 6; break run; }
        s[sp++] = m[a];
        break;
      }
      case 65: {
        const a = s[--sp], v = s[--sp];
        if (a < 0 || a > 255) { x = 6; break run; }
        m[a] = v;
        break;
      }
      case 80: {
        const v = s[--sp], t = String(v);
        if (o.length + t.length > 65536) { x = 11; break run; }
        for (let i = 0; i < t.length; i++) o.push(t.charCodeAt(i));
        break;
      }
      case 81: {
        const v = s[--sp];
        if (o.length >= 65536) { x = 11; break run; }
        o.push(v & 255);
        break;
      }
      case 82: s[sp++] = ip < d.length ? d[ip++] : -1; break;
      case 83: x = s[--sp] & 255; break run;
    }
    pc = np;
  }
  return { out: Buffer.from(o), exit: x };
}
for (let i = 1; i <= 40; i++) {
  const id = "i" + String(i).padStart(3, "0");
  const prog = fs.readFileSync(path.join(I, id, "program.bin"));
  let inp: Buffer;
  try { inp = fs.readFileSync(path.join(I, id, "input.bin")); } catch { inp = Buffer.alloc(0); }
  const r = run(prog, inp);
  const dir = path.join(O, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "stdout.bin"), r.out);
  fs.writeFileSync(path.join(dir, "exit.txt"), String(r.exit) + "\n");
}
