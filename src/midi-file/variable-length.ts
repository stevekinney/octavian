/**
 * MIDI variable-length quantity (VLQ) encode and decode utilities.
 *
 * A VLQ encodes an unsigned integer using 7 bits per byte, with the high bit
 * of each byte set to 1 for all continuation bytes and 0 for the final byte.
 *
 * Maximum representable value: 0x0FFFFFFF (4 bytes).
 */

/**
 * The maximum value representable as a 4-byte MIDI VLQ.
 */
export const MAX_VLQ_VALUE = 0x0fffffff;

/**
 * Encodes an unsigned integer as a MIDI variable-length quantity.
 *
 * @param value The integer to encode (must be in 0..0x0FFFFFFF).
 * @returns The VLQ-encoded bytes.
 * @throws {RangeError} When the value exceeds the maximum VLQ range.
 */
export function encodeVlq(value: number): readonly number[] {
  if (!Number.isInteger(value) || value < 0 || value > MAX_VLQ_VALUE) {
    throw new RangeError(`VLQ value must be an integer in 0..${MAX_VLQ_VALUE}, received ${value}.`);
  }

  if (value === 0) return [0x00];

  const bytes: number[] = [];
  let remaining = value;

  while (remaining > 0) {
    bytes.unshift(remaining & 0x7f);
    remaining >>= 7;
  }

  // Set continuation bit on all but the last byte.
  for (let i = 0; i < bytes.length - 1; i++) {
    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    bytes[i] = bytes[i]! | 0x80;
  }

  return bytes;
}

/**
 * Result of decoding a VLQ from a byte array.
 */
export type VlqDecodeResult = {
  /** The decoded integer value. */
  readonly value: number;
  /** The number of bytes consumed. */
  readonly bytesRead: number;
};

/**
 * Decodes a MIDI variable-length quantity from a byte array at the given offset.
 *
 * @param data The byte array to read from.
 * @param offset The byte offset to start reading at.
 * @param limit The exclusive upper bound the VLQ must stay within. Defaults to
 *   `data.length`. Pass a track `end` to keep a meta-length VLQ from reading
 *   bytes that belong to the next chunk.
 * @returns The decoded value and the number of bytes consumed.
 * @throws {RangeError} When the VLQ exceeds the 4-byte maximum, is truncated, or
 *   would read past `limit`.
 */
export function decodeVlq(
  data: Uint8Array,
  offset: number,
  limit: number = data.length,
): VlqDecodeResult {
  let value = 0;
  let bytesRead = 0;

  for (;;) {
    if (offset + bytesRead >= limit) {
      throw new RangeError(`Truncated VLQ at offset ${offset + bytesRead}.`);
    }

    // oxlint-disable-next-line typescript-eslint/no-non-null-assertion
    const byte = data[offset + bytesRead]!;
    bytesRead++;

    value = (value << 7) | (byte & 0x7f);

    if (bytesRead > 4) {
      throw new RangeError(`VLQ exceeds maximum 4-byte length at offset ${offset}.`);
    }

    if ((byte & 0x80) === 0) break;
  }

  return { value, bytesRead };
}
