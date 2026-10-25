// SPDX-License-Identifier: AGPL-3.0-only
//
// Minimal MessagePack reader (standard types; ext payloads come back as bytes).

export function decodeMsgpack(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const utf8 = new TextDecoder();
  let at = 0;
  const need = length => {
    if (at + length > bytes.length) throw new Error("msgpack: unexpected end");
    const start = at;
    at += length;
    return start;
  };
  const u8 = () => view.getUint8(need(1));
  const u16 = () => view.getUint16(need(2));
  const u32 = () => view.getUint32(need(4));
  const raw = length => bytes.slice(need(length), at);
  const str = length => utf8.decode(bytes.subarray(need(length), at));
  // Every element takes at least one byte, so a count beyond the input is corrupt.
  const count = length => {
    if (length > bytes.length - at) throw new Error("msgpack: bad length");
    return length;
  };
  const array = length => Array.from({ length: count(length) }, () => read());
  let depth = 0;
  const map = length => {
    const result = {};
    const entries = count(length);
    for (let index = 0; index < entries; index += 1) {
      const key = String(read());
      const value = read();
      if (key !== "__proto__") result[key] = value;
    }
    return result;
  };
  const ext = length => { u8(); return raw(length); };
  function read() {
    if (++depth > 200) throw new Error("msgpack: too deep");
    try {
      const byte = u8();
      if (byte <= 0x7f) return byte;
      if (byte <= 0x8f) return map(byte & 0x0f);
      if (byte <= 0x9f) return array(byte & 0x0f);
      if (byte <= 0xbf) return str(byte & 0x1f);
      if (byte >= 0xe0) return byte - 0x100;
      switch (byte) {
        case 0xc0: return null;
        case 0xc2: return false;
        case 0xc3: return true;
        case 0xc4: return raw(u8());
        case 0xc5: return raw(u16());
        case 0xc6: return raw(u32());
        case 0xc7: return ext(u8());
        case 0xc8: return ext(u16());
        case 0xc9: return ext(u32());
        case 0xca: return view.getFloat32(need(4));
        case 0xcb: return view.getFloat64(need(8));
        case 0xcc: return u8();
        case 0xcd: return u16();
        case 0xce: return u32();
        case 0xcf: return Number(view.getBigUint64(need(8)));
        case 0xd0: return view.getInt8(need(1));
        case 0xd1: return view.getInt16(need(2));
        case 0xd2: return view.getInt32(need(4));
        case 0xd3: return Number(view.getBigInt64(need(8)));
        case 0xd4: return ext(1);
        case 0xd5: return ext(2);
        case 0xd6: return ext(4);
        case 0xd7: return ext(8);
        case 0xd8: return ext(16);
        case 0xd9: return str(u8());
        case 0xda: return str(u16());
        case 0xdb: return str(u32());
        case 0xdc: return array(u16());
        case 0xdd: return array(u32());
        case 0xde: return map(u16());
        case 0xdf: return map(u32());
        default: throw new Error(`msgpack: unknown byte ${byte}`);
      }
    } finally {
      depth -= 1;
    }
  }
  return read();
}
