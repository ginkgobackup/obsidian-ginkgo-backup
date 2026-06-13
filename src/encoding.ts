/**
 * Robust UTF-8 / binary <-> base64 helpers that avoid the legacy
 * `unescape(encodeURIComponent(...))` trick and handle large buffers
 * without overflowing the string concatenation or `Function.prototype.apply`
 * argument limits.
 */

const CHUNK_SIZE = 0x8000; // 32 KB

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i += CHUNK_SIZE) {
		const chunk = bytes.subarray(i, i + CHUNK_SIZE);
		binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
	}
	return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function encodeText(text: string): string {
	const bytes = new TextEncoder().encode(text);
	return uint8ToBase64(bytes);
}

export function decodeText(base64: string): string {
	const bytes = base64ToUint8(base64);
	return new TextDecoder().decode(bytes);
}

export function encodeBinary(buffer: ArrayBuffer | Uint8Array): string {
	return uint8ToBase64(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
}

export function tryDecodeText(base64: string): { text: string; ok: boolean } {
	try {
		return { text: decodeText(base64), ok: true };
	} catch {
		return { text: "", ok: false };
	}
}
