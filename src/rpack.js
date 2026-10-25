// SPDX-License-Identifier: AGPL-3.0-only
//
// rpack byte map from RisuAI (src/ts/rpack/rpack_map.bin): bytes 0-255 encode,
// bytes 256-511 decode. RisuAI publishes rpack under MIT inside Risuai and
// AGPL-3.0 elsewhere; this service uses it under AGPL-3.0 (see LICENSE).
// Original: https://github.com/kwaroran/RisuAI

export const RPACK_MAP_BASE64 = "xA0eC70rP1X8RW71ZlNPGuC7MJSGumu/QVBvm+/etxBhFyDfMomonW2ryZAADF2v0sFW5RZkkYJldJfKI9ZS0f+0oOgvilg4WmAZlknb18g7PkNLpWNHqmopkvQVz2I0eNMdPOIFjipXDhvNTC3yQCwleUgPsnq1p2w35px7VH7+h9yaAuQzouuxLgPdmaaw59WIGIN89r7hXJ/DIUYfCE7QdhJf7v2PROqjXosoCTWeacwKx4UHrUrzd+ln1NqEgJO2TXP6JyZ/BMb78XI5UcI2qWis+O3FucvOdaQ9gdlCcByVEbzYjJj5WaET9xR9s+xxwOON8AGuWzEGJCI6uCz3hIvJZfu2n66zAy0BaXQf5KPs7lw0IZNKD2riYgKeIpz9PPxxx8atWWcFcG2KRBL6JIZfr9F6R87+UGPdUQZvGOBSqAmdVnNMuFNsw6AOGc8+DX4HMmhG6kj5mS6rpEkgXlU1OAy807FYFnkoChrh8s3EOduiumBydn2V73/IwN43lL+1FIGSJUWs5/Vmpys2WsET40s66I2DG3wnsJpC64eq3FSOeCbSVynUt/gvj4l18EF3wh7/2BUR5QSXF/Mx0JsA18q0Tyo72bJr2l2hPzBhvZE9Tubfvk2CjB0jEJhk9IUze5BDu6mI8dalHPbMbrlbC5bt1enFywimgEA=";

const map = Uint8Array.from(atob(RPACK_MAP_BASE64), char => char.charCodeAt(0));

/** Risu's rpack encoding, one byte at a time. */
export function encode(bytes) {
  const out = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) out[index] = map[bytes[index]];
  return out;
}

export function decode(bytes) {
  const out = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) out[index] = map[256 + bytes[index]];
  return out;
}
