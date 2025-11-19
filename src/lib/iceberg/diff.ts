export namespace diff {
	export type Diff = {
		index: number;
		deleteCount: number;
		insertText: string;
	};

	export type Diffs = Diff[];

	export const compute = computeDiff;
	export const apply = applyDiff;

	export const EncodedMimeType = "application/x.iceberg.diff";
	export const encode = encodeDiffs;
	export const decode = decodeDiffs;
}

function computeDiff(oldString: string, newString: string): diff.Diffs {
	if (oldString === newString) return [];

	const oldLen = oldString.length;
	const newLen = newString.length;

	// Find common prefix length
	let start = 0;
	while (start < oldLen && start < newLen && oldString[start] === newString[start]) {
		start++;
	}

	// Find common suffix length, without crossing the prefix
	let endOld = oldLen - 1;
	let endNew = newLen - 1;
	while (endOld >= start && endNew >= start && oldString[endOld] === newString[endNew]) {
		endOld--;
		endNew--;
	}

	const deleteCount = Math.max(0, endOld - start + 1);
	const insertText = newString.slice(start, endNew + 1);

	if (deleteCount === 0 && insertText.length === 0) return [];

	return [{ index: start, deleteCount, insertText }];
}

function applyDiff(oldString: string, diffs: diff.Diffs): string {
	if (!diffs || diffs.length === 0) return oldString;

	// Apply from highest index to lowest so earlier indices remain valid.
	const ordered = [...diffs].sort((a, b) => b.index - a.index);
	let result = oldString;

	for (const { index, deleteCount, insertText } of ordered) {
		const i = Math.max(0, Math.min(index, result.length));
		const del = Math.max(0, Math.min(deleteCount, result.length - i));
		result = result.slice(0, i) + insertText + result.slice(i + del);
	}

	return result;
}

function encodeDiffs(diffs: diff.Diffs): Uint8Array {
	// Binary format (little-endian):
	// count, (index, deleteCount, insertTextLength, insertText)
	const textEncoder = new TextEncoder();

	// Pre-encode strings and compute total length
	const encodedStrings: Uint8Array[] = [];
	let totalBytes = 4; // count
	for (const d of diffs) {
		const bytes = textEncoder.encode(d.insertText);
		encodedStrings.push(bytes);
		totalBytes += 4 + 4 + 4 + bytes.byteLength;
	}

	const out = new Uint8Array(totalBytes);
	const view = new DataView(out.buffer);
	let offset = 0;

	// Write count
	view.setUint32(offset, diffs.length >>> 0, true); offset += 4;

	// Write entries
	for (let i = 0; i < diffs.length; i++) {
		const d = diffs[i];
		const bytes = encodedStrings[i];

		view.setUint32(offset, d.index >>> 0, true); offset += 4;
		view.setUint32(offset, d.deleteCount >>> 0, true); offset += 4;
		view.setUint32(offset, bytes.byteLength >>> 0, true); offset += 4;

		out.set(bytes, offset); offset += bytes.byteLength;
	}

	return out;
}

function decodeDiffs(encoded: ArrayBuffer | ArrayBufferView): diff.Diffs {
	if (!encoded) return [];

	const u8 = (encoded instanceof ArrayBuffer)
		? new Uint8Array(encoded)
		: new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);

	if (u8.byteLength === 0) return [];

	const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
	const td = new TextDecoder();

	let offset = 0;
	const readInt = (): number => {
		if (offset + 4 > u8.byteLength) throw new Error("Invalid encoded diff: truncated buffer");
		const val = view.getUint32(offset, true);
		offset += 4;
		return val;
	}

	const readString = (len: number): string => {
		if (offset + len > u8.byteLength) throw new Error("Invalid encoded diff: truncated buffer");
		const strBytes = u8.subarray(offset, offset + len);
		offset += len;
		return td.decode(strBytes);
	}

	const count = readInt();

	const diffs: diff.Diffs = [];
	for (let i = 0; i < count; i++) {
		const index = readInt();
		const deleteCount = readInt();
		const length = readInt();
		const insertText = readString(length);
		diffs.push({ index, deleteCount, insertText });
	}

	if (offset !== u8.byteLength) {
		throw new Error("Invalid encoded diff: trailing bytes");
	}

	return diffs;
}