"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var lzma_exports = {};
__export(lzma_exports, {
  compress: () => compress,
  decompress: () => decompress
});
module.exports = __toCommonJS(lzma_exports);
const MAX_UINT32 = 4294967296;
const MAX_INT32 = 2147483647;
const MIN_INT32 = -2147483648;
const MAX_COMPRESSION_SIZE = 9223372036854776e3;
const N1_longLit = [4294967295, -MAX_UINT32];
const MIN_VALUE = [0, -9223372036854776e3];
const P0_longLit = [0, 0];
const P1_longLit = [1, 0];
function initArr(len) {
  var array = [];
  array[len - 1] = void 0;
  return array;
}
function add(a, b) {
  return create(a[0] + b[0], a[1] + b[1]);
}
function and(a, b) {
  const highBits = ~~Math.max(
    Math.min(a[1] / MAX_UINT32, MAX_INT32),
    MIN_INT32
  ) & ~~Math.max(
    Math.min(b[1] / MAX_UINT32, MAX_INT32),
    MIN_INT32
  );
  const lowBits = lowBits_0(a) & lowBits_0(b);
  let high = highBits * MAX_UINT32;
  let low = lowBits;
  if (lowBits < 0) {
    low += MAX_UINT32;
  }
  return [low, high];
}
function compare(a, b) {
  if (a[0] == b[0] && a[1] == b[1]) {
    return 0;
  }
  const nega = a[1] < 0;
  const negb = b[1] < 0;
  if (nega && !negb) {
    return -1;
  }
  if (!nega && negb) {
    return 1;
  }
  if (sub(a, b)[1] < 0) {
    return -1;
  }
  return 1;
}
function create(valueLow, valueHigh) {
  let diffHigh, diffLow;
  valueHigh %= 18446744073709552e3;
  valueLow %= 18446744073709552e3;
  diffHigh = valueHigh % MAX_UINT32;
  diffLow = Math.floor(valueLow / MAX_UINT32) * MAX_UINT32;
  valueHigh = valueHigh - diffHigh + diffLow;
  valueLow = valueLow - diffLow + diffHigh;
  while (valueLow < 0) {
    valueLow += MAX_UINT32;
    valueHigh -= MAX_UINT32;
  }
  while (valueLow > 4294967295) {
    valueLow -= MAX_UINT32;
    valueHigh += MAX_UINT32;
  }
  valueHigh = valueHigh % 18446744073709552e3;
  while (valueHigh > 9223372032559809e3) {
    valueHigh -= 18446744073709552e3;
  }
  while (valueHigh < -9223372036854776e3) {
    valueHigh += 18446744073709552e3;
  }
  return [valueLow, valueHigh];
}
function eq(a, b) {
  return a[0] == b[0] && a[1] == b[1];
}
function fromInt(value) {
  if (value >= 0) {
    return [value, 0];
  } else {
    return [value + MAX_UINT32, -MAX_UINT32];
  }
}
function lowBits_0(a) {
  if (a[0] >= 2147483648) {
    return ~~Math.max(
      Math.min(a[0] - MAX_UINT32, MAX_INT32),
      MIN_INT32
    );
  }
  return ~~Math.max(
    Math.min(a[0], MAX_INT32),
    MIN_INT32
  );
}
function pwrAsDouble(n) {
  if (n <= 30) {
    return 1 << n;
  }
  return pwrAsDouble(30) * pwrAsDouble(n - 30);
}
function shl(a, n) {
  let diff, newHigh, newLow, twoToN;
  n &= 63;
  if (eq(a, MIN_VALUE)) {
    if (!n) {
      return a;
    }
    return P0_longLit;
  }
  if (a[1] < 0) {
    throw new Error("Neg");
  }
  twoToN = pwrAsDouble(n);
  newHigh = a[1] * twoToN % 18446744073709552e3;
  newLow = a[0] * twoToN;
  diff = newLow - newLow % MAX_UINT32;
  newHigh += diff;
  newLow -= diff;
  if (newHigh >= MAX_COMPRESSION_SIZE) {
    newHigh -= 18446744073709552e3;
  }
  return [newLow, newHigh];
}
function shr(a, n) {
  n &= 63;
  let shiftFact = pwrAsDouble(n);
  return create(
    Math.floor(a[0] / shiftFact),
    a[1] / shiftFact
  );
}
function shru(a, n) {
  let sr = shr(a, n);
  n &= 63;
  if (a[1] < 0) {
    sr = add(sr, shl([2, 0], 63 - n));
  }
  return sr;
}
function sub(a, b) {
  return create(a[0] - b[0], a[1] - b[1]);
}
function $ByteArrayInputStream(obj, buf) {
  obj.buf = buf;
  obj.pos = 0;
  obj.count = buf.length;
  return obj;
}
function $read(obj) {
  if (obj.pos >= obj.count) {
    return -1;
  }
  return obj.buf[obj.pos++] & 255;
}
function $read_0(obj, buf, off, len) {
  if (obj.pos >= obj.count) {
    return -1;
  }
  len = Math.min(len, obj.count - obj.pos);
  arraycopy(obj.buf, obj.pos, buf, off, len);
  obj.pos += len;
  return len;
}
function $toByteArray(obj) {
  const data = obj.buf;
  data.length = obj.count;
  return data;
}
function $write(obj, b) {
  obj.buf[obj.count++] = b << 24 >> 24;
}
function $write_0(obj, buf, off, len) {
  arraycopy(buf, off, obj.buf, obj.count, len);
  obj.count += len;
}
function $getChars(obj, srcBegin, srcEnd, dst, dstBegin) {
  var srcIdx;
  for (srcIdx = srcBegin; srcIdx < srcEnd; ++srcIdx) {
    dst[dstBegin++] = obj.charCodeAt(srcIdx);
  }
}
function arraycopy(src, srcOfs, dest, destOfs, len) {
  for (let i = 0; i < len; ++i) {
    try {
      dest[destOfs + i] = src[srcOfs + i];
    } catch (error) {
      break;
    }
  }
}
function $configure(mode, encoder) {
  $SetDictionarySize_0(encoder, 1 << mode.s);
  encoder._numFastBytes = mode.f;
  $SetMatchFinder(encoder, mode.m);
  encoder._numLiteralContextBits = 3;
  encoder._numLiteralPosStateBits = 0;
  encoder._posStateBits = 2;
  encoder._posStateMask = 3;
}
function $init(obj, input, output, len, mode) {
  if (compare(len, N1_longLit) < 0) {
    throw new Error("invalid length " + len);
  }
  obj.length_0 = len;
  let encoder = $Encoder();
  $configure(mode, encoder);
  writeHeaderProperties(encoder, output);
  for (let i = 0; i < 64; i += 8) {
    $write(output, lowBits_0(shr(len, i)) & 255);
  }
  obj.chunker = (encoder._needReleaseMFStream = 0, encoder._inStream = input, encoder._finished = 0, $Create_2(encoder), encoder._rangeEncoder.Stream = output, $Init_4(encoder), $FillDistancesPrices(encoder), $FillAlignPrices(encoder), encoder._lenEncoder._tableSize = encoder._numFastBytes + 1 - 2, $UpdateTables(encoder._lenEncoder, 1 << encoder._posStateBits), encoder._repMatchLenEncoder._tableSize = encoder._numFastBytes + 1 - 2, $UpdateTables(
    encoder._repMatchLenEncoder,
    1 << encoder._posStateBits
  ), encoder.nowPos64 = P0_longLit, void 0, $Chunker_0({}, encoder));
}
function $LZMAByteArrayCompressor(obj, data, mode) {
  obj.output = {
    buf: initArr(32),
    count: 0
  };
  $init(
    obj,
    $ByteArrayInputStream({}, data),
    obj.output,
    fromInt(data.length),
    mode
  );
  return obj;
}
function $init_0(obj, input, output) {
  let hex_length = "", properties = [], r, tmp_length;
  for (let i = 0; i < 5; ++i) {
    r = $read(input);
    if (r == -1) {
      throw new Error("truncated input");
    }
    properties[i] = r << 24 >> 24;
  }
  let decoder = $Decoder({});
  if (!$SetDecoderProperties(decoder, properties)) {
    throw new Error("corrupted input");
  }
  for (let i = 0; i < 64; i += 8) {
    r = $read(input);
    if (r == -1) {
      throw new Error("truncated input");
    }
    r = r.toString(16);
    if (r.length == 1)
      r = "0" + r;
    hex_length = r + "" + hex_length;
  }
  if (/^0+$|^f+$/i.test(hex_length)) {
    obj.length_0 = N1_longLit;
  } else {
    tmp_length = parseInt(hex_length, 16);
    if (tmp_length > 4294967295) {
      obj.length_0 = N1_longLit;
    } else {
      obj.length_0 = fromInt(tmp_length);
    }
  }
  obj.chunker = $CodeInChunks(
    decoder,
    input,
    output,
    obj.length_0
  );
}
function $LZMAByteArrayDecompressor(obj, data) {
  obj.output = {
    buf: initArr(32),
    count: 0
  };
  $init_0(obj, $ByteArrayInputStream({}, data), obj.output);
  return obj;
}
function $Create_4(obj, keepSizeBefore, keepSizeAfter, keepSizeReserv) {
  let blockSize;
  obj._keepSizeBefore = keepSizeBefore;
  obj._keepSizeAfter = keepSizeAfter;
  blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv;
  if (obj._bufferBase == null || obj._blockSize != blockSize) {
    obj._bufferBase = null;
    obj._blockSize = blockSize;
    obj._bufferBase = initArr(obj._blockSize);
  }
  obj._pointerToLastSafePosition = obj._blockSize - keepSizeAfter;
}
function $GetIndexByte(obj, index) {
  return obj._bufferBase[obj._bufferOffset + obj._pos + index];
}
function $GetMatchLen(obj, index, distance, limit) {
  if (obj._streamEndWasReached) {
    if (obj._pos + index + limit > obj._streamPos) {
      limit = obj._streamPos - (obj._pos + index);
    }
  }
  ;
  ++distance;
  let i, pby = obj._bufferOffset + obj._pos + index;
  for (i = 0; i < limit && obj._bufferBase[pby + i] == obj._bufferBase[pby + i - distance]; ++i)
    ;
  return i;
}
function $GetNumAvailableBytes(obj) {
  return obj._streamPos - obj._pos;
}
function $MoveBlock(obj) {
  let offset = obj._bufferOffset + obj._pos - obj._keepSizeBefore;
  if (offset > 0) {
    ;
    --offset;
  }
  let numBytes = obj._bufferOffset + obj._streamPos - offset;
  for (let i = 0; i < numBytes; ++i) {
    obj._bufferBase[i] = obj._bufferBase[offset + i];
  }
  obj._bufferOffset -= offset;
}
function $MovePos_1(obj) {
  var pointerToPostion;
  obj._pos += 1;
  if (obj._pos > obj._posLimit) {
    pointerToPostion = obj._bufferOffset + obj._pos;
    if (pointerToPostion > obj._pointerToLastSafePosition) {
      $MoveBlock(obj);
    }
    $ReadBlock(obj);
  }
}
function $ReadBlock(obj) {
  let numReadBytes, pointerToPostion, size;
  if (obj._streamEndWasReached) {
    return;
  }
  while (1) {
    size = -obj._bufferOffset + obj._blockSize - obj._streamPos;
    if (!size) {
      return;
    }
    numReadBytes = $read_0(
      obj._stream,
      obj._bufferBase,
      obj._bufferOffset + obj._streamPos,
      size
    );
    if (numReadBytes == -1) {
      obj._posLimit = obj._streamPos;
      pointerToPostion = obj._bufferOffset + obj._posLimit;
      if (pointerToPostion > obj._pointerToLastSafePosition) {
        obj._posLimit = obj._pointerToLastSafePosition - obj._bufferOffset;
      }
      obj._streamEndWasReached = 1;
      return;
    }
    obj._streamPos += numReadBytes;
    if (obj._streamPos >= obj._pos + obj._keepSizeAfter) {
      obj._posLimit = obj._streamPos - obj._keepSizeAfter;
    }
  }
}
function $ReduceOffsets(obj, subValue) {
  obj._bufferOffset += subValue;
  obj._posLimit -= subValue;
  obj._pos -= subValue;
  obj._streamPos -= subValue;
}
const crcTable = function() {
  const crcTable2 = [];
  for (let i = 0, r; i < 256; ++i, r = i) {
    r = i;
    for (let j = 0; j < 8; ++j) {
      if ((r & 1) != 0) {
        r >>>= 1;
        r ^= -306674912;
      } else {
        r >>>= 1;
      }
    }
    crcTable2[i] = r;
  }
  return crcTable2;
}();
function $Create_3(obj, historySize, keepAddBufferBefore, matchMaxLen, keepAddBufferAfter) {
  if (historySize < 1073741567) {
    obj._cutValue = 16 + (matchMaxLen >> 1);
    let windowReservSize = ~~((historySize + keepAddBufferBefore + matchMaxLen + keepAddBufferAfter) / 2) + 256;
    $Create_4(
      obj,
      historySize + keepAddBufferBefore,
      matchMaxLen + keepAddBufferAfter,
      windowReservSize
    );
    obj._matchMaxLen = matchMaxLen;
    let cyclicBufferSize = historySize + 1;
    if (obj._cyclicBufferSize != cyclicBufferSize) {
      obj._son = initArr(
        (obj._cyclicBufferSize = cyclicBufferSize) * 2
      );
    }
    let hs = 65536;
    if (obj.HASH_ARRAY) {
      hs = historySize - 1;
      hs |= hs >> 1;
      hs |= hs >> 2;
      hs |= hs >> 4;
      hs |= hs >> 8;
      hs >>= 1;
      hs |= 65535;
      if (hs > 16777216) {
        hs >>= 1;
      }
      obj._hashMask = hs;
      hs += 1;
      hs += obj.kFixHashSize;
    }
    if (hs != obj._hashSizeSum) {
      obj._hash = initArr(obj._hashSizeSum = hs);
    }
  }
}
function $GetMatches(obj, distances) {
  var count, cur, curMatch, curMatch2, curMatch3, cyclicPos, delta, hash2Value, hash3Value, hashValue, len, len0, len1, lenLimit, matchMinPos, maxLen, offset, pby1, ptr0, ptr1, temp;
  if (obj._pos + obj._matchMaxLen <= obj._streamPos) {
    lenLimit = obj._matchMaxLen;
  } else {
    lenLimit = obj._streamPos - obj._pos;
    if (lenLimit < obj.kMinMatchCheck) {
      $MovePos_0(obj);
      return 0;
    }
  }
  offset = 0;
  matchMinPos = obj._pos > obj._cyclicBufferSize ? obj._pos - obj._cyclicBufferSize : 0;
  cur = obj._bufferOffset + obj._pos;
  maxLen = 1;
  hash2Value = 0;
  hash3Value = 0;
  if (obj.HASH_ARRAY) {
    temp = crcTable[obj._bufferBase[cur] & 255] ^ obj._bufferBase[cur + 1] & 255;
    hash2Value = temp & 1023;
    temp ^= (obj._bufferBase[cur + 2] & 255) << 8;
    hash3Value = temp & 65535;
    hashValue = (temp ^ crcTable[obj._bufferBase[cur + 3] & 255] << 5) & obj._hashMask;
  } else {
    hashValue = obj._bufferBase[cur] & 255 ^ (obj._bufferBase[cur + 1] & 255) << 8;
  }
  curMatch = obj._hash[obj.kFixHashSize + hashValue] || 0;
  if (obj.HASH_ARRAY) {
    curMatch2 = obj._hash[hash2Value] || 0;
    curMatch3 = obj._hash[1024 + hash3Value] || 0;
    obj._hash[hash2Value] = obj._pos;
    obj._hash[1024 + hash3Value] = obj._pos;
    if (curMatch2 > matchMinPos) {
      if (obj._bufferBase[obj._bufferOffset + curMatch2] == obj._bufferBase[cur]) {
        distances[offset++] = maxLen = 2;
        distances[offset++] = obj._pos - curMatch2 - 1;
      }
    }
    if (curMatch3 > matchMinPos) {
      if (obj._bufferBase[obj._bufferOffset + curMatch3] == obj._bufferBase[cur]) {
        if (curMatch3 == curMatch2) {
          offset -= 2;
        }
        distances[offset++] = maxLen = 3;
        distances[offset++] = obj._pos - curMatch3 - 1;
        curMatch2 = curMatch3;
      }
    }
    if (offset != 0 && curMatch2 == curMatch) {
      offset -= 2;
      maxLen = 1;
    }
  }
  obj._hash[obj.kFixHashSize + hashValue] = obj._pos;
  ptr0 = (obj._cyclicBufferPos << 1) + 1;
  ptr1 = obj._cyclicBufferPos << 1;
  len0 = len1 = obj.kNumHashDirectBytes;
  if (obj.kNumHashDirectBytes != 0) {
    if (curMatch > matchMinPos) {
      if (obj._bufferBase[obj._bufferOffset + curMatch + obj.kNumHashDirectBytes] != obj._bufferBase[cur + obj.kNumHashDirectBytes]) {
        distances[offset++] = maxLen = obj.kNumHashDirectBytes;
        distances[offset++] = obj._pos - curMatch - 1;
      }
    }
  }
  count = obj._cutValue;
  while (1) {
    if (curMatch <= matchMinPos || count == 0) {
      count -= 1;
      obj._son[ptr0] = obj._son[ptr1] = 0;
      break;
    }
    delta = obj._pos - curMatch;
    cyclicPos = (delta <= obj._cyclicBufferPos ? obj._cyclicBufferPos - delta : obj._cyclicBufferPos - delta + obj._cyclicBufferSize) << 1;
    pby1 = obj._bufferOffset + curMatch;
    len = len0 < len1 ? len0 : len1;
    if (obj._bufferBase[pby1 + len] == obj._bufferBase[cur + len]) {
      while ((len += 1) != lenLimit) {
        if (obj._bufferBase[pby1 + len] != obj._bufferBase[cur + len]) {
          break;
        }
      }
      if (maxLen < len) {
        distances[offset++] = maxLen = len;
        distances[offset++] = delta - 1;
        if (len == lenLimit) {
          obj._son[ptr1] = obj._son[cyclicPos];
          obj._son[ptr0] = obj._son[cyclicPos + 1];
          break;
        }
      }
    }
    if ((obj._bufferBase[pby1 + len] & 255) < (obj._bufferBase[cur + len] & 255)) {
      obj._son[ptr1] = curMatch;
      ptr1 = cyclicPos + 1;
      curMatch = obj._son[ptr1];
      len1 = len;
    } else {
      obj._son[ptr0] = curMatch;
      ptr0 = cyclicPos;
      curMatch = obj._son[ptr0];
      len0 = len;
    }
  }
  $MovePos_0(obj);
  return offset;
}
function $Init_5(obj) {
  obj._bufferOffset = 0;
  obj._pos = 0;
  obj._streamPos = 0;
  obj._streamEndWasReached = 0;
  $ReadBlock(obj);
  obj._cyclicBufferPos = 0;
  $ReduceOffsets(obj, -1);
}
function $MovePos_0(obj) {
  var subValue;
  if ((obj._cyclicBufferPos += 1) >= obj._cyclicBufferSize) {
    obj._cyclicBufferPos = 0;
  }
  $MovePos_1(obj);
  if (obj._pos == 1073741823) {
    subValue = obj._pos - obj._cyclicBufferSize;
    $NormalizeLinks(
      obj._son,
      obj._cyclicBufferSize * 2,
      subValue
    );
    $NormalizeLinks(obj._hash, obj._hashSizeSum, subValue);
    $ReduceOffsets(obj, subValue);
  }
}
function $NormalizeLinks(items, numItems, subValue) {
  var i, value;
  for (i = 0; i < numItems; ++i) {
    value = items[i] || 0;
    if (value <= subValue) {
      value = 0;
    } else {
      value -= subValue;
    }
    items[i] = value;
  }
}
function $SetType(obj, numHashBytes) {
  obj.HASH_ARRAY = numHashBytes > 2;
  if (obj.HASH_ARRAY) {
    obj.kNumHashDirectBytes = 0;
    obj.kMinMatchCheck = 4;
    obj.kFixHashSize = 66560;
  } else {
    obj.kNumHashDirectBytes = 2;
    obj.kMinMatchCheck = 3;
    obj.kFixHashSize = 0;
  }
}
function $Skip(obj, num) {
  var count, cur, curMatch, cyclicPos, delta, hash2Value, hash3Value, hashValue, len, len0, len1, lenLimit, matchMinPos, pby1, ptr0, ptr1, temp;
  do {
    if (obj._pos + obj._matchMaxLen <= obj._streamPos) {
      lenLimit = obj._matchMaxLen;
    } else {
      lenLimit = obj._streamPos - obj._pos;
      if (lenLimit < obj.kMinMatchCheck) {
        $MovePos_0(obj);
        continue;
      }
    }
    matchMinPos = obj._pos > obj._cyclicBufferSize ? obj._pos - obj._cyclicBufferSize : 0;
    cur = obj._bufferOffset + obj._pos;
    if (obj.HASH_ARRAY) {
      temp = crcTable[obj._bufferBase[cur] & 255] ^ obj._bufferBase[cur + 1] & 255;
      hash2Value = temp & 1023;
      obj._hash[hash2Value] = obj._pos;
      temp ^= (obj._bufferBase[cur + 2] & 255) << 8;
      hash3Value = temp & 65535;
      obj._hash[1024 + hash3Value] = obj._pos;
      hashValue = (temp ^ crcTable[obj._bufferBase[cur + 3] & 255] << 5) & obj._hashMask;
    } else {
      hashValue = obj._bufferBase[cur] & 255 ^ (obj._bufferBase[cur + 1] & 255) << 8;
    }
    curMatch = obj._hash[obj.kFixHashSize + hashValue];
    obj._hash[obj.kFixHashSize + hashValue] = obj._pos;
    ptr0 = (obj._cyclicBufferPos << 1) + 1;
    ptr1 = obj._cyclicBufferPos << 1;
    len0 = len1 = obj.kNumHashDirectBytes;
    count = obj._cutValue;
    while (1) {
      if (curMatch <= matchMinPos || count == 0) {
        count -= 1;
        obj._son[ptr0] = obj._son[ptr1] = 0;
        break;
      }
      delta = obj._pos - curMatch;
      cyclicPos = (delta <= obj._cyclicBufferPos ? obj._cyclicBufferPos - delta : obj._cyclicBufferPos - delta + obj._cyclicBufferSize) << 1;
      pby1 = obj._bufferOffset + curMatch;
      len = len0 < len1 ? len0 : len1;
      if (obj._bufferBase[pby1 + len] == obj._bufferBase[cur + len]) {
        while ((len += 1) != lenLimit) {
          if (obj._bufferBase[pby1 + len] != obj._bufferBase[cur + len]) {
            break;
          }
        }
        if (len == lenLimit) {
          obj._son[ptr1] = obj._son[cyclicPos];
          obj._son[ptr0] = obj._son[cyclicPos + 1];
          break;
        }
      }
      if ((obj._bufferBase[pby1 + len] & 255) < (obj._bufferBase[cur + len] & 255)) {
        obj._son[ptr1] = curMatch;
        ptr1 = cyclicPos + 1;
        curMatch = obj._son[ptr1];
        len1 = len;
      } else {
        obj._son[ptr0] = curMatch;
        ptr0 = cyclicPos;
        curMatch = obj._son[ptr0];
        len0 = len;
      }
    }
    $MovePos_0(obj);
  } while ((num -= 1) != 0);
}
function $CopyBlock(obj, distance, len) {
  var pos = obj._pos - distance - 1;
  if (pos < 0) {
    pos += obj._windowSize;
  }
  for (; len != 0; len -= 1) {
    if (pos >= obj._windowSize) {
      pos = 0;
    }
    obj._buffer[obj._pos] = obj._buffer[pos];
    obj._pos += 1;
    pos += 1;
    if (obj._pos >= obj._windowSize) {
      $Flush_0(obj);
    }
  }
}
function $Create_5(obj, windowSize) {
  if (obj._buffer == null || obj._windowSize != windowSize) {
    obj._buffer = initArr(windowSize);
  }
  obj._windowSize = windowSize;
  obj._pos = 0;
  obj._streamPos = 0;
}
function $Flush_0(obj) {
  var size = obj._pos - obj._streamPos;
  if (!size) {
    return;
  }
  $write_0(
    obj._stream,
    obj._buffer,
    obj._streamPos,
    size
  );
  if (obj._pos >= obj._windowSize) {
    obj._pos = 0;
  }
  obj._streamPos = obj._pos;
}
function $GetByte(obj, distance) {
  var pos = obj._pos - distance - 1;
  if (pos < 0) {
    pos += obj._windowSize;
  }
  return obj._buffer[pos];
}
function $PutByte(obj, b) {
  obj._buffer[obj._pos] = b;
  obj._pos += 1;
  if (obj._pos >= obj._windowSize) {
    $Flush_0(obj);
  }
}
function $ReleaseStream(obj) {
  $Flush_0(obj);
  obj._stream = null;
}
function GetLenToPosState(len) {
  len -= 2;
  if (len < 4) {
    return len;
  }
  return 3;
}
function StateUpdateChar(index) {
  if (index < 4) {
    return 0;
  }
  if (index < 10) {
    return index - 3;
  }
  return index - 6;
}
function $Chunker_0(obj, encoder) {
  obj.encoder = encoder;
  obj.decoder = null;
  obj.alive = 1;
  return obj;
}
function $Chunker(obj, decoder) {
  obj.decoder = decoder;
  obj.encoder = null;
  obj.alive = 1;
  return obj;
}
function $processChunkDecode(obj) {
  if (!obj.alive)
    throw new Error("Bad state");
  if (obj.encoder) {
    throw new Error("No encoding");
  } else {
    $processDecoderChunk(obj);
  }
  return obj.alive;
}
function $processDecoderChunk(obj) {
  const result = $CodeOneChunk(obj.decoder);
  if (result === -1) {
    throw new Error("Corrupted input");
  }
  obj.inBytesProcessed = N1_longLit;
  obj.outBytesProcessed = obj.decoder.nowPos64;
  if (result || compare(obj.decoder.outSize, P0_longLit) >= 0 && compare(obj.decoder.nowPos64, obj.decoder.outSize) >= 0) {
    $Flush_0(obj.decoder.m_OutWindow);
    $ReleaseStream(obj.decoder.m_OutWindow);
    obj.decoder.m_RangeDecoder.Stream = null;
    obj.alive = 0;
  }
}
function $processChunkEncode(obj) {
  if (!obj.alive) {
    throw new Error("bad state");
  }
  if (obj.encoder) {
    $processEncoderChunk(obj);
  } else {
    throw new Error("No decoding");
  }
  return obj.alive;
}
function $processEncoderChunk(obj) {
  $CodeOneBlock(
    obj.encoder,
    obj.encoder.processedInSize,
    obj.encoder.processedOutSize,
    obj.encoder.finished
  );
  obj.inBytesProcessed = obj.encoder.processedInSize[0];
  if (obj.encoder.finished[0]) {
    $ReleaseStreams(obj.encoder);
    obj.alive = 0;
  }
}
function $CodeInChunks(obj, inStream, outStream, outSize) {
  obj.m_RangeDecoder.Stream = inStream;
  $ReleaseStream(obj.m_OutWindow);
  obj.m_OutWindow._stream = outStream;
  $Init_1(obj);
  obj.state = 0;
  obj.rep0 = 0;
  obj.rep1 = 0;
  obj.rep2 = 0;
  obj.rep3 = 0;
  obj.outSize = outSize;
  obj.nowPos64 = P0_longLit;
  obj.prevByte = 0;
  return $Chunker({}, obj);
}
function $CodeOneChunk(obj) {
  var decoder2, distance, len, numDirectBits, posSlot, posState;
  posState = lowBits_0(obj.nowPos64) & obj.m_PosStateMask;
  if (!decodeBit(
    obj.m_RangeDecoder,
    obj.m_IsMatchDecoders,
    (obj.state << 4) + posState
  )) {
    decoder2 = $GetDecoder(
      obj.m_LiteralDecoder,
      lowBits_0(obj.nowPos64),
      obj.prevByte
    );
    if (obj.state < 7) {
      obj.prevByte = $DecodeNormal(
        decoder2,
        obj.m_RangeDecoder
      );
    } else {
      obj.prevByte = $DecodeWithMatchByte(
        decoder2,
        obj.m_RangeDecoder,
        $GetByte(obj.m_OutWindow, obj.rep0)
      );
    }
    $PutByte(obj.m_OutWindow, obj.prevByte);
    obj.state = StateUpdateChar(obj.state);
    obj.nowPos64 = add(obj.nowPos64, P1_longLit);
  } else {
    if (decodeBit(
      obj.m_RangeDecoder,
      obj.m_IsRepDecoders,
      obj.state
    )) {
      len = 0;
      if (!decodeBit(
        obj.m_RangeDecoder,
        obj.m_IsRepG0Decoders,
        obj.state
      )) {
        if (!decodeBit(
          obj.m_RangeDecoder,
          obj.m_IsRep0LongDecoders,
          (obj.state << 4) + posState
        )) {
          obj.state = obj.state < 7 ? 9 : 11;
          len = 1;
        }
      } else {
        if (!decodeBit(
          obj.m_RangeDecoder,
          obj.m_IsRepG1Decoders,
          obj.state
        )) {
          distance = obj.rep1;
        } else {
          if (!decodeBit(
            obj.m_RangeDecoder,
            obj.m_IsRepG2Decoders,
            obj.state
          )) {
            distance = obj.rep2;
          } else {
            distance = obj.rep3;
            obj.rep3 = obj.rep2;
          }
          obj.rep2 = obj.rep1;
        }
        obj.rep1 = obj.rep0;
        obj.rep0 = distance;
      }
      if (!len) {
        len = $Decode(
          obj.m_RepLenDecoder,
          obj.m_RangeDecoder,
          posState
        ) + 2;
        obj.state = obj.state < 7 ? 8 : 11;
      }
    } else {
      obj.rep3 = obj.rep2;
      obj.rep2 = obj.rep1;
      obj.rep1 = obj.rep0;
      len = 2 + $Decode(
        obj.m_LenDecoder,
        obj.m_RangeDecoder,
        posState
      );
      obj.state = obj.state < 7 ? 7 : 10;
      posSlot = $Decode_0(
        obj.m_PosSlotDecoder[GetLenToPosState(len)],
        obj.m_RangeDecoder
      );
      if (posSlot >= 4) {
        numDirectBits = (posSlot >> 1) - 1;
        obj.rep0 = (2 | posSlot & 1) << numDirectBits;
        if (posSlot < 14) {
          obj.rep0 += reverseDecode(
            obj.m_PosDecoders,
            obj.rep0 - posSlot - 1,
            obj.m_RangeDecoder,
            numDirectBits
          );
        } else {
          obj.rep0 += $DecodeDirectBits(
            obj.m_RangeDecoder,
            numDirectBits - 4
          ) << 4;
          obj.rep0 += $ReverseDecode(
            obj.m_PosAlignDecoder,
            obj.m_RangeDecoder
          );
          if (obj.rep0 < 0) {
            if (obj.rep0 == -1) {
              return 1;
            }
            return -1;
          }
        }
      } else {
        obj.rep0 = posSlot;
      }
    }
    if (compare(fromInt(obj.rep0), obj.nowPos64) >= 0 || obj.rep0 >= obj.m_DictionarySizeCheck) {
      return -1;
    }
    $CopyBlock(obj.m_OutWindow, obj.rep0, len);
    obj.nowPos64 = add(obj.nowPos64, fromInt(len));
    obj.prevByte = $GetByte(obj.m_OutWindow, 0);
  }
  return 0;
}
function $Decoder(obj) {
  obj.m_OutWindow = {};
  obj.m_RangeDecoder = {};
  obj.m_IsMatchDecoders = initArr(192);
  obj.m_IsRepDecoders = initArr(12);
  obj.m_IsRepG0Decoders = initArr(12);
  obj.m_IsRepG1Decoders = initArr(12);
  obj.m_IsRepG2Decoders = initArr(12);
  obj.m_IsRep0LongDecoders = initArr(192);
  obj.m_PosSlotDecoder = initArr(4);
  obj.m_PosDecoders = initArr(114);
  obj.m_PosAlignDecoder = $BitTreeDecoder({}, 4);
  obj.m_LenDecoder = $Decoder$LenDecoder({});
  obj.m_RepLenDecoder = $Decoder$LenDecoder({});
  obj.m_LiteralDecoder = {};
  for (let i = 0; i < 4; ++i) {
    obj.m_PosSlotDecoder[i] = $BitTreeDecoder({}, 6);
  }
  return obj;
}
function $Init_1(obj) {
  obj.m_OutWindow._streamPos = 0;
  obj.m_OutWindow._pos = 0;
  InitBitModels(obj.m_IsMatchDecoders);
  InitBitModels(obj.m_IsRep0LongDecoders);
  InitBitModels(obj.m_IsRepDecoders);
  InitBitModels(obj.m_IsRepG0Decoders);
  InitBitModels(obj.m_IsRepG1Decoders);
  InitBitModels(obj.m_IsRepG2Decoders);
  InitBitModels(obj.m_PosDecoders);
  $Init_0(obj.m_LiteralDecoder);
  for (let i = 0; i < 4; ++i) {
    InitBitModels(obj.m_PosSlotDecoder[i].Models);
  }
  $Init(obj.m_LenDecoder);
  $Init(obj.m_RepLenDecoder);
  InitBitModels(obj.m_PosAlignDecoder.Models);
  $Init_8(obj.m_RangeDecoder);
}
function $SetDecoderProperties(obj, properties) {
  var dictionarySize, i, lc, lp, pb, remainder, val;
  if (properties.length < 5) {
    return 0;
  }
  val = properties[0] & 255;
  lc = val % 9;
  remainder = ~~(val / 9);
  lp = remainder % 5;
  pb = ~~(remainder / 5);
  dictionarySize = 0;
  for (i = 0; i < 4; ++i) {
    dictionarySize += (properties[1 + i] & 255) << i * 8;
  }
  if (dictionarySize > 99999999 || !$SetLcLpPb(obj, lc, lp, pb)) {
    return 0;
  }
  return $SetDictionarySize(obj, dictionarySize);
}
function $SetDictionarySize(obj, dictionarySize) {
  if (dictionarySize < 0) {
    return 0;
  }
  if (obj.m_DictionarySize != dictionarySize) {
    obj.m_DictionarySize = dictionarySize;
    obj.m_DictionarySizeCheck = Math.max(
      obj.m_DictionarySize,
      1
    );
    $Create_5(
      obj.m_OutWindow,
      Math.max(obj.m_DictionarySizeCheck, 4096)
    );
  }
  return 1;
}
function $SetLcLpPb(obj, lc, lp, pb) {
  if (lc > 8 || lp > 4 || pb > 4) {
    return 0;
  }
  $Create_0(obj.m_LiteralDecoder, lp, lc);
  var numPosStates = 1 << pb;
  $Create(obj.m_LenDecoder, numPosStates);
  $Create(obj.m_RepLenDecoder, numPosStates);
  obj.m_PosStateMask = numPosStates - 1;
  return 1;
}
function $Create(obj, numPosStates) {
  for (; obj.m_NumPosStates < numPosStates; obj.m_NumPosStates += 1) {
    obj.m_LowCoder[obj.m_NumPosStates] = $BitTreeDecoder({}, 3);
    obj.m_MidCoder[obj.m_NumPosStates] = $BitTreeDecoder({}, 3);
  }
}
function $Decode(obj, rangeDecoder, posState) {
  if (!decodeBit(rangeDecoder, obj.m_Choice, 0)) {
    return $Decode_0(obj.m_LowCoder[posState], rangeDecoder);
  }
  let symbol = 8;
  if (!decodeBit(rangeDecoder, obj.m_Choice, 1)) {
    symbol += $Decode_0(obj.m_MidCoder[posState], rangeDecoder);
  } else {
    symbol += 8 + $Decode_0(obj.m_HighCoder, rangeDecoder);
  }
  return symbol;
}
function $Decoder$LenDecoder(obj) {
  obj.m_Choice = initArr(2);
  obj.m_LowCoder = initArr(16);
  obj.m_MidCoder = initArr(16);
  obj.m_HighCoder = $BitTreeDecoder({}, 8);
  obj.m_NumPosStates = 0;
  return obj;
}
function $Init(obj) {
  InitBitModels(obj.m_Choice);
  for (let posState = 0; posState < obj.m_NumPosStates; ++posState) {
    InitBitModels(obj.m_LowCoder[posState].Models);
    InitBitModels(obj.m_MidCoder[posState].Models);
  }
  InitBitModels(obj.m_HighCoder.Models);
}
function $Create_0(obj, numPosBits, numPrevBits) {
  var i, numStates;
  if (obj.m_Coders !== null && obj.m_NumPrevBits == numPrevBits && obj.m_NumPosBits == numPosBits) {
    return;
  }
  obj.m_NumPosBits = numPosBits;
  obj.m_PosMask = (1 << numPosBits) - 1;
  obj.m_NumPrevBits = numPrevBits;
  numStates = 1 << obj.m_NumPrevBits + obj.m_NumPosBits;
  obj.m_Coders = initArr(numStates);
  for (i = 0; i < numStates; ++i) {
    obj.m_Coders[i] = $Decoder$LiteralDecoder$Decoder2({});
  }
}
function $GetDecoder(obj, pos, prevByte) {
  return obj.m_Coders[((pos & obj.m_PosMask) << obj.m_NumPrevBits) + ((prevByte & 255) >>> 8 - obj.m_NumPrevBits)];
}
function $Init_0(obj) {
  var i, numStates;
  numStates = 1 << obj.m_NumPrevBits + obj.m_NumPosBits;
  for (i = 0; i < numStates; ++i) {
    InitBitModels(obj.m_Coders[i].m_Decoders);
  }
}
function $DecodeNormal(obj, rangeDecoder) {
  var symbol = 1;
  do {
    symbol = symbol << 1 | decodeBit(rangeDecoder, obj.m_Decoders, symbol);
  } while (symbol < 256);
  return symbol << 24 >> 24;
}
function $DecodeWithMatchByte(obj, rangeDecoder, matchByte) {
  var bit, matchBit, symbol = 1;
  do {
    matchBit = matchByte >> 7 & 1;
    matchByte <<= 1;
    bit = decodeBit(
      rangeDecoder,
      obj.m_Decoders,
      (1 + matchBit << 8) + symbol
    );
    symbol = symbol << 1 | bit;
    if (matchBit != bit) {
      while (symbol < 256) {
        symbol = symbol << 1 | decodeBit(rangeDecoder, obj.m_Decoders, symbol);
      }
      break;
    }
  } while (symbol < 256);
  return symbol << 24 >> 24;
}
function $Decoder$LiteralDecoder$Decoder2(obj) {
  obj.m_Decoders = initArr(768);
  return obj;
}
const g_FastPos = function() {
  let j, k, slotFast, c = 2, g_FastPos2 = [0, 1];
  for (slotFast = 2; slotFast < 22; ++slotFast) {
    let s = slotFast;
    s >>= 1;
    s -= 1;
    k = 1;
    k <<= s;
    for (j = 0; j < k; ++j, ++c) {
      g_FastPos2[c] = slotFast << 24 >> 24;
    }
  }
  return g_FastPos2;
}();
function $Backward(obj, cur) {
  let backCur, backMem, posMem, posPrev;
  obj._optimumEndIndex = cur;
  posMem = obj._optimum[cur].PosPrev;
  backMem = obj._optimum[cur].BackPrev;
  do {
    if (obj._optimum[cur].Prev1IsChar) {
      $MakeAsChar(obj._optimum[posMem]);
      obj._optimum[posMem].PosPrev = posMem - 1;
      if (obj._optimum[cur].Prev2) {
        obj._optimum[posMem - 1].Prev1IsChar = 0;
        obj._optimum[posMem - 1].PosPrev = obj._optimum[cur].PosPrev2;
        obj._optimum[posMem - 1].BackPrev = obj._optimum[cur].BackPrev2;
      }
    }
    posPrev = posMem;
    backCur = backMem;
    backMem = obj._optimum[posPrev].BackPrev;
    posMem = obj._optimum[posPrev].PosPrev;
    obj._optimum[posPrev].BackPrev = backCur;
    obj._optimum[posPrev].PosPrev = cur;
    cur = posPrev;
  } while (cur > 0);
  obj.backRes = obj._optimum[0].BackPrev;
  obj._optimumCurrentIndex = obj._optimum[0].PosPrev;
  return obj._optimumCurrentIndex;
}
function $BaseInit(obj) {
  obj._state = 0;
  obj._previousByte = 0;
  for (let i = 0; i < 4; ++i) {
    obj._repDistances[i] = 0;
  }
}
function $CodeOneBlock(obj, inSize, outSize, finished) {
  let baseVal, complexState, curByte, distance, footerBits, i, len, lenToPosState, matchByte, pos, posReduced, posSlot, posState, progressPosValuePrev, subCoder;
  inSize[0] = P0_longLit;
  outSize[0] = P0_longLit;
  finished[0] = 1;
  if (obj._inStream) {
    obj._matchFinder._stream = obj._inStream;
    $Init_5(obj._matchFinder);
    obj._needReleaseMFStream = 1;
    obj._inStream = null;
  }
  if (obj._finished) {
    return;
  }
  obj._finished = 1;
  progressPosValuePrev = obj.nowPos64;
  if (eq(obj.nowPos64, P0_longLit)) {
    if (!$GetNumAvailableBytes(obj._matchFinder)) {
      $Flush(obj, lowBits_0(obj.nowPos64));
      return;
    }
    $ReadMatchDistances(obj);
    posState = lowBits_0(obj.nowPos64) & obj._posStateMask;
    $Encode_3(
      obj._rangeEncoder,
      obj._isMatch,
      (obj._state << 4) + posState,
      0
    );
    obj._state = StateUpdateChar(obj._state);
    curByte = $GetIndexByte(
      obj._matchFinder,
      -obj._additionalOffset
    );
    $Encode_1(
      $GetSubCoder(
        obj._literalEncoder,
        lowBits_0(obj.nowPos64),
        obj._previousByte
      ),
      obj._rangeEncoder,
      curByte
    );
    obj._previousByte = curByte;
    obj._additionalOffset -= 1;
    obj.nowPos64 = add(obj.nowPos64, P1_longLit);
  }
  if (!$GetNumAvailableBytes(obj._matchFinder)) {
    $Flush(obj, lowBits_0(obj.nowPos64));
    return;
  }
  while (1) {
    len = $GetOptimum(obj, lowBits_0(obj.nowPos64));
    pos = obj.backRes;
    posState = lowBits_0(obj.nowPos64) & obj._posStateMask;
    complexState = (obj._state << 4) + posState;
    if (len == 1 && pos == -1) {
      $Encode_3(
        obj._rangeEncoder,
        obj._isMatch,
        complexState,
        0
      );
      curByte = $GetIndexByte(
        obj._matchFinder,
        -obj._additionalOffset
      );
      subCoder = $GetSubCoder(
        obj._literalEncoder,
        lowBits_0(obj.nowPos64),
        obj._previousByte
      );
      if (obj._state < 7) {
        $Encode_1(subCoder, obj._rangeEncoder, curByte);
      } else {
        matchByte = $GetIndexByte(
          obj._matchFinder,
          -obj._repDistances[0] - 1 - obj._additionalOffset
        );
        $EncodeMatched(
          subCoder,
          obj._rangeEncoder,
          matchByte,
          curByte
        );
      }
      obj._previousByte = curByte;
      obj._state = StateUpdateChar(obj._state);
    } else {
      $Encode_3(
        obj._rangeEncoder,
        obj._isMatch,
        complexState,
        1
      );
      if (pos < 4) {
        $Encode_3(
          obj._rangeEncoder,
          obj._isRep,
          obj._state,
          1
        );
        if (!pos) {
          $Encode_3(
            obj._rangeEncoder,
            obj._isRepG0,
            obj._state,
            0
          );
          if (len == 1) {
            $Encode_3(
              obj._rangeEncoder,
              obj._isRep0Long,
              complexState,
              0
            );
          } else {
            $Encode_3(
              obj._rangeEncoder,
              obj._isRep0Long,
              complexState,
              1
            );
          }
        } else {
          $Encode_3(
            obj._rangeEncoder,
            obj._isRepG0,
            obj._state,
            1
          );
          if (pos == 1) {
            $Encode_3(
              obj._rangeEncoder,
              obj._isRepG1,
              obj._state,
              0
            );
          } else {
            $Encode_3(
              obj._rangeEncoder,
              obj._isRepG1,
              obj._state,
              1
            );
            $Encode_3(
              obj._rangeEncoder,
              obj._isRepG2,
              obj._state,
              pos - 2
            );
          }
        }
        if (len == 1) {
          obj._state = obj._state < 7 ? 9 : 11;
        } else {
          $Encode_0(
            obj._repMatchLenEncoder,
            obj._rangeEncoder,
            len - 2,
            posState
          );
          obj._state = obj._state < 7 ? 8 : 11;
        }
        distance = obj._repDistances[pos];
        if (pos != 0) {
          for (let i2 = pos; i2 >= 1; --i2) {
            obj._repDistances[i2] = obj._repDistances[i2 - 1];
          }
          obj._repDistances[0] = distance;
        }
      } else {
        $Encode_3(
          obj._rangeEncoder,
          obj._isRep,
          obj._state,
          0
        );
        obj._state = obj._state < 7 ? 7 : 10;
        $Encode_0(
          obj._lenEncoder,
          obj._rangeEncoder,
          len - 2,
          posState
        );
        pos -= 4;
        posSlot = GetPosSlot(pos);
        lenToPosState = GetLenToPosState(len);
        $Encode_2(
          obj._posSlotEncoder[lenToPosState],
          obj._rangeEncoder,
          posSlot
        );
        if (posSlot >= 4) {
          footerBits = (posSlot >> 1) - 1;
          baseVal = (2 | posSlot & 1) << footerBits;
          posReduced = pos - baseVal;
          if (posSlot < 14) {
            ReverseEncode(
              obj._posEncoders,
              baseVal - posSlot - 1,
              obj._rangeEncoder,
              footerBits,
              posReduced
            );
          } else {
            $EncodeDirectBits(
              obj._rangeEncoder,
              posReduced >> 4,
              footerBits - 4
            );
            $ReverseEncode(
              obj._posAlignEncoder,
              obj._rangeEncoder,
              posReduced & 15
            );
            obj._alignPriceCount += 1;
          }
        }
        distance = pos;
        for (let i2 = 3; i2 >= 1; --i2) {
          obj._repDistances[i2] = obj._repDistances[i2 - 1];
        }
        obj._repDistances[0] = distance;
        obj._matchPriceCount += 1;
      }
      obj._previousByte = $GetIndexByte(
        obj._matchFinder,
        len - 1 - obj._additionalOffset
      );
    }
    obj._additionalOffset -= len;
    obj.nowPos64 = add(obj.nowPos64, fromInt(len));
    if (!obj._additionalOffset) {
      if (obj._matchPriceCount >= 128) {
        $FillDistancesPrices(obj);
      }
      if (obj._alignPriceCount >= 16) {
        $FillAlignPrices(obj);
      }
      inSize[0] = obj.nowPos64;
      outSize[0] = $GetProcessedSizeAdd(obj._rangeEncoder);
      if (!$GetNumAvailableBytes(obj._matchFinder)) {
        $Flush(obj, lowBits_0(obj.nowPos64));
        return;
      }
      if (compare(
        sub(obj.nowPos64, progressPosValuePrev),
        [4096, 0]
      ) >= 0) {
        obj._finished = 0;
        finished[0] = 0;
        return;
      }
    }
  }
}
function $Create_2(obj) {
  var bt, numHashBytes;
  if (!obj._matchFinder) {
    bt = {};
    numHashBytes = 4;
    if (!obj._matchFinderType) {
      numHashBytes = 2;
    }
    $SetType(bt, numHashBytes);
    obj._matchFinder = bt;
  }
  $Create_1(
    obj._literalEncoder,
    obj._numLiteralPosStateBits,
    obj._numLiteralContextBits
  );
  if (obj._dictionarySize == obj._dictionarySizePrev && obj._numFastBytesPrev == obj._numFastBytes) {
    return;
  }
  $Create_3(
    obj._matchFinder,
    obj._dictionarySize,
    4096,
    obj._numFastBytes,
    274
  );
  obj._dictionarySizePrev = obj._dictionarySize;
  obj._numFastBytesPrev = obj._numFastBytes;
}
function $Encoder() {
  const obj = {
    _repDistances: initArr(4),
    _optimum: [],
    _rangeEncoder: {},
    _isMatch: initArr(192),
    _isRep: initArr(12),
    _isRepG0: initArr(12),
    _isRepG1: initArr(12),
    _isRepG2: initArr(12),
    _isRep0Long: initArr(192),
    _posSlotEncoder: [],
    _posEncoders: initArr(114),
    _posAlignEncoder: bitTreeEncoder({}, 4),
    _lenEncoder: $Encoder$LenPriceTableEncoder({}),
    _repMatchLenEncoder: $Encoder$LenPriceTableEncoder({}),
    _literalEncoder: {},
    _matchDistances: [],
    _posSlotPrices: [],
    _distancesPrices: [],
    _alignPrices: initArr(16),
    reps: initArr(4),
    repLens: initArr(4),
    processedInSize: [P0_longLit],
    processedOutSize: [P0_longLit],
    finished: [0],
    properties: initArr(5),
    tempPrices: initArr(128),
    _longestMatchLength: 0,
    _matchFinderType: 1,
    _numDistancePairs: 0,
    _numFastBytesPrev: -1,
    backRes: 0
  };
  for (let i = 0; i < 4096; ++i) {
    obj._optimum[i] = {};
  }
  for (let i = 0; i < 4; ++i) {
    obj._posSlotEncoder[i] = bitTreeEncoder({}, 6);
  }
  return obj;
}
function $FillAlignPrices(obj) {
  for (let i = 0; i < 16; ++i) {
    obj._alignPrices[i] = $ReverseGetPrice(obj._posAlignEncoder, i);
  }
  obj._alignPriceCount = 0;
}
function $FillDistancesPrices(obj) {
  var baseVal, encoder, footerBits, posSlot, st, st2;
  for (let i = 4; i < 128; ++i) {
    posSlot = GetPosSlot(i);
    footerBits = (posSlot >> 1) - 1;
    baseVal = (2 | posSlot & 1) << footerBits;
    obj.tempPrices[i] = ReverseGetPrice(
      obj._posEncoders,
      baseVal - posSlot - 1,
      footerBits,
      i - baseVal
    );
  }
  for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
    encoder = obj._posSlotEncoder[lenToPosState];
    st = lenToPosState << 6;
    for (posSlot = 0; posSlot < obj._distTableSize; posSlot += 1) {
      obj._posSlotPrices[st + posSlot] = $GetPrice_1(
        encoder,
        posSlot
      );
    }
    for (posSlot = 14; posSlot < obj._distTableSize; posSlot += 1) {
      obj._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
    }
    st2 = lenToPosState * 128;
    for (let i = 0; i < 4; ++i) {
      obj._distancesPrices[st2 + i] = obj._posSlotPrices[st + i];
    }
    for (let i = 4; i < 128; ++i) {
      obj._distancesPrices[st2 + i] = obj._posSlotPrices[st + GetPosSlot(i)] + obj.tempPrices[i];
    }
  }
  obj._matchPriceCount = 0;
}
function $Flush(obj, nowPos) {
  $ReleaseMFStream(obj);
  $WriteEndMarker(obj, nowPos & obj._posStateMask);
  for (let i = 0; i < 5; ++i) {
    $ShiftLow(obj._rangeEncoder);
  }
}
function $GetOptimum(obj, position) {
  let cur, curAnd1Price, curAndLenCharPrice, curAndLenPrice, curBack, curPrice, currentByte, distance, len, lenEnd, lenMain, lenTest, lenTest2, lenTestTemp, matchByte, matchPrice, newLen, nextIsChar, nextMatchPrice, nextOptimum, nextRepMatchPrice, normalMatchPrice, numAvailableBytes, numAvailableBytesFull, numDistancePairs, offs, offset, opt, optimum, pos, posPrev, posState, posStateNext, price_4, repIndex, repLen, repMatchPrice, repMaxIndex, shortRepPrice, startLen, state, state2, t, price, price_0, price_1, price_2, price_3;
  if (obj._optimumEndIndex != obj._optimumCurrentIndex) {
    const lenRes2 = obj._optimum[obj._optimumCurrentIndex].PosPrev - obj._optimumCurrentIndex;
    obj.backRes = obj._optimum[obj._optimumCurrentIndex].BackPrev;
    obj._optimumCurrentIndex = obj._optimum[obj._optimumCurrentIndex].PosPrev;
    return lenRes2;
  }
  obj._optimumCurrentIndex = obj._optimumEndIndex = 0;
  if (obj._longestMatchWasFound) {
    lenMain = obj._longestMatchLength;
    obj._longestMatchWasFound = 0;
  } else {
    lenMain = $ReadMatchDistances(obj);
  }
  numDistancePairs = obj._numDistancePairs;
  numAvailableBytes = $GetNumAvailableBytes(obj._matchFinder) + 1;
  if (numAvailableBytes < 2) {
    obj.backRes = -1;
    return 1;
  }
  if (numAvailableBytes > 273) {
    numAvailableBytes = 273;
  }
  repMaxIndex = 0;
  for (let i = 0; i < 4; ++i) {
    obj.reps[i] = obj._repDistances[i];
    obj.repLens[i] = $GetMatchLen(
      obj._matchFinder,
      -1,
      obj.reps[i],
      273
    );
    if (obj.repLens[i] > obj.repLens[repMaxIndex]) {
      repMaxIndex = i;
    }
  }
  if (obj.repLens[repMaxIndex] >= obj._numFastBytes) {
    obj.backRes = repMaxIndex;
    lenRes = obj.repLens[repMaxIndex];
    $MovePos(obj, lenRes - 1);
    return lenRes;
  }
  if (lenMain >= obj._numFastBytes) {
    obj.backRes = obj._matchDistances[numDistancePairs - 1] + 4;
    $MovePos(obj, lenMain - 1);
    return lenMain;
  }
  currentByte = $GetIndexByte(obj._matchFinder, -1);
  matchByte = $GetIndexByte(
    obj._matchFinder,
    -obj._repDistances[0] - 1 - 1
  );
  if (lenMain < 2 && currentByte != matchByte && obj.repLens[repMaxIndex] < 2) {
    obj.backRes = -1;
    return 1;
  }
  obj._optimum[0].State = obj._state;
  posState = position & obj._posStateMask;
  obj._optimum[1].Price = ProbPrices[obj._isMatch[(obj._state << 4) + posState] >>> 2] + $GetPrice_0(
    $GetSubCoder(
      obj._literalEncoder,
      position,
      obj._previousByte
    ),
    obj._state >= 7,
    matchByte,
    currentByte
  );
  $MakeAsChar(obj._optimum[1]);
  matchPrice = ProbPrices[2048 - obj._isMatch[(obj._state << 4) + posState] >>> 2];
  repMatchPrice = matchPrice + ProbPrices[2048 - obj._isRep[obj._state] >>> 2];
  if (matchByte == currentByte) {
    shortRepPrice = repMatchPrice + $GetRepLen1Price(obj, obj._state, posState);
    if (shortRepPrice < obj._optimum[1].Price) {
      obj._optimum[1].Price = shortRepPrice;
      $MakeAsShortRep(obj._optimum[1]);
    }
  }
  lenEnd = lenMain >= obj.repLens[repMaxIndex] ? lenMain : obj.repLens[repMaxIndex];
  if (lenEnd < 2) {
    obj.backRes = obj._optimum[1].BackPrev;
    return 1;
  }
  obj._optimum[1].PosPrev = 0;
  obj._optimum[0].Backs0 = obj.reps[0];
  obj._optimum[0].Backs1 = obj.reps[1];
  obj._optimum[0].Backs2 = obj.reps[2];
  obj._optimum[0].Backs3 = obj.reps[3];
  len = lenEnd;
  do {
    obj._optimum[len].Price = 268435455;
    len -= 1;
  } while (len >= 2);
  for (let i = 0; i < 4; ++i) {
    repLen = obj.repLens[i];
    if (repLen < 2) {
      continue;
    }
    price_4 = repMatchPrice + $GetPureRepPrice(obj, i, obj._state, posState);
    do {
      curAndLenPrice = price_4 + $GetPrice(
        obj._repMatchLenEncoder,
        repLen - 2,
        posState
      );
      optimum = obj._optimum[repLen];
      if (curAndLenPrice < optimum.Price) {
        optimum.Price = curAndLenPrice;
        optimum.PosPrev = 0;
        optimum.BackPrev = i;
        optimum.Prev1IsChar = 0;
      }
    } while ((repLen -= 1) >= 2);
  }
  normalMatchPrice = matchPrice + ProbPrices[obj._isRep[obj._state] >>> 2];
  len = obj.repLens[0] >= 2 ? obj.repLens[0] + 1 : 2;
  if (len <= lenMain) {
    offs = 0;
    while (len > obj._matchDistances[offs]) {
      offs += 2;
    }
    for (; ; len += 1) {
      distance = obj._matchDistances[offs + 1];
      curAndLenPrice = normalMatchPrice + $GetPosLenPrice(obj, distance, len, posState);
      optimum = obj._optimum[len];
      if (curAndLenPrice < optimum.Price) {
        optimum.Price = curAndLenPrice;
        optimum.PosPrev = 0;
        optimum.BackPrev = distance + 4;
        optimum.Prev1IsChar = 0;
      }
      if (len == obj._matchDistances[offs]) {
        offs += 2;
        if (offs == numDistancePairs) {
          break;
        }
      }
    }
  }
  cur = 0;
  while (1) {
    ;
    ++cur;
    if (cur == lenEnd) {
      return $Backward(obj, cur);
    }
    newLen = $ReadMatchDistances(obj);
    numDistancePairs = obj._numDistancePairs;
    if (newLen >= obj._numFastBytes) {
      obj._longestMatchLength = newLen;
      obj._longestMatchWasFound = 1;
      return $Backward(obj, cur);
    }
    position += 1;
    posPrev = obj._optimum[cur].PosPrev;
    if (obj._optimum[cur].Prev1IsChar) {
      posPrev -= 1;
      if (obj._optimum[cur].Prev2) {
        state = obj._optimum[obj._optimum[cur].PosPrev2].State;
        if (obj._optimum[cur].BackPrev2 < 4) {
          state = state < 7 ? 8 : 11;
        } else {
          state = state < 7 ? 7 : 10;
        }
      } else {
        state = obj._optimum[posPrev].State;
      }
      state = StateUpdateChar(state);
    } else {
      state = obj._optimum[posPrev].State;
    }
    if (posPrev == cur - 1) {
      if (!obj._optimum[cur].BackPrev) {
        state = state < 7 ? 9 : 11;
      } else {
        state = StateUpdateChar(state);
      }
    } else {
      if (obj._optimum[cur].Prev1IsChar && obj._optimum[cur].Prev2) {
        posPrev = obj._optimum[cur].PosPrev2;
        pos = obj._optimum[cur].BackPrev2;
        state = state < 7 ? 8 : 11;
      } else {
        pos = obj._optimum[cur].BackPrev;
        if (pos < 4) {
          state = state < 7 ? 8 : 11;
        } else {
          state = state < 7 ? 7 : 10;
        }
      }
      opt = obj._optimum[posPrev];
      if (pos < 4) {
        if (!pos) {
          obj.reps[0] = opt.Backs0;
          obj.reps[1] = opt.Backs1;
          obj.reps[2] = opt.Backs2;
          obj.reps[3] = opt.Backs3;
        } else if (pos == 1) {
          obj.reps[0] = opt.Backs1;
          obj.reps[1] = opt.Backs0;
          obj.reps[2] = opt.Backs2;
          obj.reps[3] = opt.Backs3;
        } else if (pos == 2) {
          obj.reps[0] = opt.Backs2;
          obj.reps[1] = opt.Backs0;
          obj.reps[2] = opt.Backs1;
          obj.reps[3] = opt.Backs3;
        } else {
          obj.reps[0] = opt.Backs3;
          obj.reps[1] = opt.Backs0;
          obj.reps[2] = opt.Backs1;
          obj.reps[3] = opt.Backs2;
        }
      } else {
        obj.reps[0] = pos - 4;
        obj.reps[1] = opt.Backs0;
        obj.reps[2] = opt.Backs1;
        obj.reps[3] = opt.Backs2;
      }
    }
    obj._optimum[cur].State = state;
    obj._optimum[cur].Backs0 = obj.reps[0];
    obj._optimum[cur].Backs1 = obj.reps[1];
    obj._optimum[cur].Backs2 = obj.reps[2];
    obj._optimum[cur].Backs3 = obj.reps[3];
    curPrice = obj._optimum[cur].Price;
    currentByte = $GetIndexByte(obj._matchFinder, -1);
    matchByte = $GetIndexByte(
      obj._matchFinder,
      -obj.reps[0] - 1 - 1
    );
    posState = position & obj._posStateMask;
    curAnd1Price = curPrice + ProbPrices[obj._isMatch[(state << 4) + posState] >>> 2] + $GetPrice_0(
      $GetSubCoder(
        obj._literalEncoder,
        position,
        $GetIndexByte(obj._matchFinder, -2)
      ),
      state >= 7,
      matchByte,
      currentByte
    );
    nextOptimum = obj._optimum[cur + 1];
    nextIsChar = 0;
    if (curAnd1Price < nextOptimum.Price) {
      nextOptimum.Price = curAnd1Price;
      nextOptimum.PosPrev = cur;
      nextOptimum.BackPrev = -1;
      nextOptimum.Prev1IsChar = 0;
      nextIsChar = 1;
    }
    matchPrice = curPrice + ProbPrices[2048 - obj._isMatch[(state << 4) + posState] >>> 2];
    repMatchPrice = matchPrice + ProbPrices[2048 - obj._isRep[state] >>> 2];
    if (matchByte == currentByte && !(nextOptimum.PosPrev < cur && !nextOptimum.BackPrev)) {
      shortRepPrice = repMatchPrice + (ProbPrices[obj._isRepG0[state] >>> 2] + ProbPrices[obj._isRep0Long[(state << 4) + posState] >>> 2]);
      if (shortRepPrice <= nextOptimum.Price) {
        nextOptimum.Price = shortRepPrice;
        nextOptimum.PosPrev = cur;
        nextOptimum.BackPrev = 0;
        nextOptimum.Prev1IsChar = 0;
        nextIsChar = 1;
      }
    }
    numAvailableBytesFull = $GetNumAvailableBytes(obj._matchFinder) + 1;
    numAvailableBytesFull = 4095 - cur < numAvailableBytesFull ? 4095 - cur : numAvailableBytesFull;
    numAvailableBytes = numAvailableBytesFull;
    if (numAvailableBytes < 2) {
      continue;
    }
    if (numAvailableBytes > obj._numFastBytes) {
      numAvailableBytes = obj._numFastBytes;
    }
    if (!nextIsChar && matchByte != currentByte) {
      t = Math.min(numAvailableBytesFull - 1, obj._numFastBytes);
      lenTest2 = $GetMatchLen(
        obj._matchFinder,
        0,
        obj.reps[0],
        t
      );
      if (lenTest2 >= 2) {
        state2 = StateUpdateChar(state);
        posStateNext = position + 1 & obj._posStateMask;
        nextRepMatchPrice = curAnd1Price + ProbPrices[2048 - obj._isMatch[(state2 << 4) + posStateNext] >>> 2] + ProbPrices[2048 - obj._isRep[state2] >>> 2];
        offset = cur + 1 + lenTest2;
        while (lenEnd < offset) {
          obj._optimum[lenEnd += 1].Price = 268435455;
        }
        curAndLenPrice = nextRepMatchPrice + (price = $GetPrice(
          obj._repMatchLenEncoder,
          lenTest2 - 2,
          posStateNext
        ), price + $GetPureRepPrice(
          obj,
          0,
          state2,
          posStateNext
        ));
        optimum = obj._optimum[offset];
        if (curAndLenPrice < optimum.Price) {
          optimum.Price = curAndLenPrice;
          optimum.PosPrev = cur + 1;
          optimum.BackPrev = 0;
          optimum.Prev1IsChar = 1;
          optimum.Prev2 = 0;
        }
      }
    }
    startLen = 2;
    for (repIndex = 0; repIndex < 4; ++repIndex) {
      lenTest = $GetMatchLen(
        obj._matchFinder,
        -1,
        obj.reps[repIndex],
        numAvailableBytes
      );
      if (lenTest < 2) {
        continue;
      }
      lenTestTemp = lenTest;
      do {
        while (lenEnd < cur + lenTest) {
          obj._optimum[lenEnd += 1].Price = 268435455;
        }
        curAndLenPrice = repMatchPrice + (price_0 = $GetPrice(
          obj._repMatchLenEncoder,
          lenTest - 2,
          posState
        ), price_0 + $GetPureRepPrice(
          obj,
          repIndex,
          state,
          posState
        ));
        optimum = obj._optimum[cur + lenTest];
        if (curAndLenPrice < optimum.Price) {
          optimum.Price = curAndLenPrice;
          optimum.PosPrev = cur;
          optimum.BackPrev = repIndex;
          optimum.Prev1IsChar = 0;
        }
      } while ((lenTest -= 1) >= 2);
      lenTest = lenTestTemp;
      if (!repIndex) {
        startLen = lenTest + 1;
      }
      if (lenTest < numAvailableBytesFull) {
        t = Math.min(
          numAvailableBytesFull - 1 - lenTest,
          obj._numFastBytes
        );
        lenTest2 = $GetMatchLen(
          obj._matchFinder,
          lenTest,
          obj.reps[repIndex],
          t
        );
        if (lenTest2 >= 2) {
          state2 = state < 7 ? 8 : 11;
          posStateNext = position + lenTest & obj._posStateMask;
          curAndLenCharPrice = repMatchPrice + (price_1 = $GetPrice(
            obj._repMatchLenEncoder,
            lenTest - 2,
            posState
          ), price_1 + $GetPureRepPrice(
            obj,
            repIndex,
            state,
            posState
          )) + ProbPrices[obj._isMatch[(state2 << 4) + posStateNext] >>> 2] + $GetPrice_0(
            $GetSubCoder(
              obj._literalEncoder,
              position + lenTest,
              $GetIndexByte(
                obj._matchFinder,
                lenTest - 1 - 1
              )
            ),
            1,
            $GetIndexByte(
              obj._matchFinder,
              lenTest - 1 - (obj.reps[repIndex] + 1)
            ),
            $GetIndexByte(obj._matchFinder, lenTest - 1)
          );
          state2 = StateUpdateChar(state2);
          posStateNext = position + lenTest + 1 & obj._posStateMask;
          nextMatchPrice = curAndLenCharPrice + ProbPrices[2048 - obj._isMatch[(state2 << 4) + posStateNext] >>> 2];
          nextRepMatchPrice = nextMatchPrice + ProbPrices[2048 - obj._isRep[state2] >>> 2];
          offset = lenTest + 1 + lenTest2;
          while (lenEnd < cur + offset) {
            obj._optimum[lenEnd += 1].Price = 268435455;
          }
          curAndLenPrice = nextRepMatchPrice + (price_2 = $GetPrice(
            obj._repMatchLenEncoder,
            lenTest2 - 2,
            posStateNext
          ), price_2 + $GetPureRepPrice(
            obj,
            0,
            state2,
            posStateNext
          ));
          optimum = obj._optimum[cur + offset];
          if (curAndLenPrice < optimum.Price) {
            optimum.Price = curAndLenPrice;
            optimum.PosPrev = cur + lenTest + 1;
            optimum.BackPrev = 0;
            optimum.Prev1IsChar = 1;
            optimum.Prev2 = 1;
            optimum.PosPrev2 = cur;
            optimum.BackPrev2 = repIndex;
          }
        }
      }
    }
    if (newLen > numAvailableBytes) {
      newLen = numAvailableBytes;
      for (numDistancePairs = 0; newLen > obj._matchDistances[numDistancePairs]; numDistancePairs += 2) {
      }
      obj._matchDistances[numDistancePairs] = newLen;
      numDistancePairs += 2;
    }
    if (newLen >= startLen) {
      normalMatchPrice = matchPrice + ProbPrices[obj._isRep[state] >>> 2];
      while (lenEnd < cur + newLen) {
        obj._optimum[lenEnd += 1].Price = 268435455;
      }
      offs = 0;
      while (startLen > obj._matchDistances[offs]) {
        offs += 2;
      }
      for (lenTest = startLen; ; lenTest += 1) {
        curBack = obj._matchDistances[offs + 1];
        curAndLenPrice = normalMatchPrice + $GetPosLenPrice(obj, curBack, lenTest, posState);
        optimum = obj._optimum[cur + lenTest];
        if (curAndLenPrice < optimum.Price) {
          optimum.Price = curAndLenPrice;
          optimum.PosPrev = cur;
          optimum.BackPrev = curBack + 4;
          optimum.Prev1IsChar = 0;
        }
        if (lenTest == obj._matchDistances[offs]) {
          if (lenTest < numAvailableBytesFull) {
            t = Math.min(
              numAvailableBytesFull - 1 - lenTest,
              obj._numFastBytes
            );
            lenTest2 = $GetMatchLen(
              obj._matchFinder,
              lenTest,
              curBack,
              t
            );
            if (lenTest2 >= 2) {
              state2 = state < 7 ? 7 : 10;
              posStateNext = position + lenTest & obj._posStateMask;
              curAndLenCharPrice = curAndLenPrice + ProbPrices[obj._isMatch[(state2 << 4) + posStateNext] >>> 2] + $GetPrice_0(
                $GetSubCoder(
                  obj._literalEncoder,
                  position + lenTest,
                  $GetIndexByte(
                    obj._matchFinder,
                    lenTest - 1 - 1
                  )
                ),
                1,
                $GetIndexByte(
                  obj._matchFinder,
                  lenTest - (curBack + 1) - 1
                ),
                $GetIndexByte(
                  obj._matchFinder,
                  lenTest - 1
                )
              );
              state2 = StateUpdateChar(state2);
              posStateNext = position + lenTest + 1 & obj._posStateMask;
              nextMatchPrice = curAndLenCharPrice + ProbPrices[2048 - obj._isMatch[(state2 << 4) + posStateNext] >>> 2];
              nextRepMatchPrice = nextMatchPrice + ProbPrices[2048 - obj._isRep[state2] >>> 2];
              offset = lenTest + 1 + lenTest2;
              while (lenEnd < cur + offset) {
                obj._optimum[lenEnd += 1].Price = 268435455;
              }
              curAndLenPrice = nextRepMatchPrice + (price_3 = $GetPrice(
                obj._repMatchLenEncoder,
                lenTest2 - 2,
                posStateNext
              ), price_3 + $GetPureRepPrice(
                obj,
                0,
                state2,
                posStateNext
              ));
              optimum = obj._optimum[cur + offset];
              if (curAndLenPrice < optimum.Price) {
                optimum.Price = curAndLenPrice;
                optimum.PosPrev = cur + lenTest + 1;
                optimum.BackPrev = 0;
                optimum.Prev1IsChar = 1;
                optimum.Prev2 = 1;
                optimum.PosPrev2 = cur;
                optimum.BackPrev2 = curBack + 4;
              }
            }
          }
          offs += 2;
          if (offs == numDistancePairs) {
            break;
          }
        }
      }
    }
  }
}
function $GetPosLenPrice(obj, pos, len, posState) {
  let price, lenToPosState = GetLenToPosState(len);
  if (pos < 128) {
    price = obj._distancesPrices[lenToPosState * 128 + pos];
  } else {
    price = obj._posSlotPrices[(lenToPosState << 6) + GetPosSlot2(pos)] + obj._alignPrices[pos & 15];
  }
  return price + $GetPrice(obj._lenEncoder, len - 2, posState);
}
function $GetPureRepPrice(obj, repIndex, state, posState) {
  var price;
  if (!repIndex) {
    price = ProbPrices[obj._isRepG0[state] >>> 2];
    price += ProbPrices[2048 - obj._isRep0Long[(state << 4) + posState] >>> 2];
  } else {
    price = ProbPrices[2048 - obj._isRepG0[state] >>> 2];
    if (repIndex == 1) {
      price += ProbPrices[obj._isRepG1[state] >>> 2];
    } else {
      price += ProbPrices[2048 - obj._isRepG1[state] >>> 2];
      price += GetPrice(obj._isRepG2[state], repIndex - 2);
    }
  }
  return price;
}
function $GetRepLen1Price(obj, state, posState) {
  return ProbPrices[obj._isRepG0[state] >>> 2] + ProbPrices[obj._isRep0Long[(state << 4) + posState] >>> 2];
}
function $Init_4(obj) {
  $BaseInit(obj);
  $Init_9(obj._rangeEncoder);
  InitBitModels(obj._isMatch);
  InitBitModels(obj._isRep0Long);
  InitBitModels(obj._isRep);
  InitBitModels(obj._isRepG0);
  InitBitModels(obj._isRepG1);
  InitBitModels(obj._isRepG2);
  InitBitModels(obj._posEncoders);
  $Init_3(obj._literalEncoder);
  for (let i = 0; i < 4; ++i) {
    InitBitModels(obj._posSlotEncoder[i].Models);
  }
  $Init_2(obj._lenEncoder, 1 << obj._posStateBits);
  $Init_2(obj._repMatchLenEncoder, 1 << obj._posStateBits);
  InitBitModels(obj._posAlignEncoder.Models);
  obj._longestMatchWasFound = 0;
  obj._optimumEndIndex = 0;
  obj._optimumCurrentIndex = 0;
  obj._additionalOffset = 0;
}
function $MovePos(obj, num) {
  if (num > 0) {
    $Skip(obj._matchFinder, num);
    obj._additionalOffset += num;
  }
}
function $ReadMatchDistances(obj) {
  var lenRes2 = 0;
  obj._numDistancePairs = $GetMatches(
    obj._matchFinder,
    obj._matchDistances
  );
  if (obj._numDistancePairs > 0) {
    lenRes2 = obj._matchDistances[obj._numDistancePairs - 2];
    if (lenRes2 == obj._numFastBytes) {
      lenRes2 += $GetMatchLen(
        obj._matchFinder,
        lenRes2 - 1,
        obj._matchDistances[obj._numDistancePairs - 1],
        273 - lenRes2
      );
    }
  }
  obj._additionalOffset += 1;
  return lenRes2;
}
function $ReleaseMFStream(obj) {
  if (obj._matchFinder && obj._needReleaseMFStream) {
    obj._matchFinder._stream = null;
    obj._needReleaseMFStream = 0;
  }
}
function $ReleaseStreams(obj) {
  $ReleaseMFStream(obj);
  obj._rangeEncoder.Stream = null;
}
function $SetDictionarySize_0(obj, dictionarySize) {
  obj._dictionarySize = dictionarySize;
  for (var dicLogSize = 0; dictionarySize > 1 << dicLogSize; ++dicLogSize)
    ;
  obj._distTableSize = dicLogSize * 2;
}
function $SetMatchFinder(obj, matchFinderIndex) {
  var matchFinderIndexPrev = obj._matchFinderType;
  obj._matchFinderType = matchFinderIndex;
  if (obj._matchFinder && matchFinderIndexPrev != obj._matchFinderType) {
    obj._dictionarySizePrev = -1;
    obj._matchFinder = null;
  }
}
function writeHeaderProperties(obj, outStream) {
  obj.properties[0] = (obj._posStateBits * 5 + obj._numLiteralPosStateBits) * 9 + (obj._numLiteralContextBits << 24 >> 24);
  for (let i = 0; i < 4; ++i) {
    obj.properties[1 + i] = obj._dictionarySize >> 8 * (i << 24 >> 24);
  }
  $write_0(
    outStream,
    obj.properties,
    0,
    5
  );
}
function $WriteEndMarker(obj, posState) {
  $Encode_3(
    obj._rangeEncoder,
    obj._isMatch,
    (obj._state << 4) + posState,
    1
  );
  $Encode_3(
    obj._rangeEncoder,
    obj._isRep,
    obj._state,
    0
  );
  obj._state = obj._state < 7 ? 7 : 10;
  $Encode_0(obj._lenEncoder, obj._rangeEncoder, 0, posState);
  var lenToPosState = GetLenToPosState(2);
  $Encode_2(
    obj._posSlotEncoder[lenToPosState],
    obj._rangeEncoder,
    63
  );
  $EncodeDirectBits(obj._rangeEncoder, 67108863, 26);
  $ReverseEncode(obj._posAlignEncoder, obj._rangeEncoder, 15);
}
function GetPosSlot(pos) {
  if (pos < 2048) {
    return g_FastPos[pos];
  }
  if (pos < 2097152) {
    return g_FastPos[pos >> 10] + 20;
  }
  return g_FastPos[pos >> 20] + 40;
}
function GetPosSlot2(pos) {
  if (pos < 131072) {
    return g_FastPos[pos >> 6] + 12;
  }
  if (pos < 134217728) {
    return g_FastPos[pos >> 16] + 32;
  }
  return g_FastPos[pos >> 26] + 52;
}
function $Encode(obj, rangeEncoder, symbol, posState) {
  if (symbol < 8) {
    $Encode_3(rangeEncoder, obj._choice, 0, 0);
    $Encode_2(obj._lowCoder[posState], rangeEncoder, symbol);
  } else {
    symbol -= 8;
    $Encode_3(rangeEncoder, obj._choice, 0, 1);
    if (symbol < 8) {
      $Encode_3(rangeEncoder, obj._choice, 1, 0);
      $Encode_2(obj._midCoder[posState], rangeEncoder, symbol);
    } else {
      $Encode_3(rangeEncoder, obj._choice, 1, 1);
      $Encode_2(obj._highCoder, rangeEncoder, symbol - 8);
    }
  }
}
function $Encoder$LenEncoder(obj) {
  obj._choice = initArr(2);
  obj._lowCoder = initArr(16);
  obj._midCoder = initArr(16);
  obj._highCoder = bitTreeEncoder({}, 8);
  for (let posState = 0; posState < 16; ++posState) {
    obj._lowCoder[posState] = bitTreeEncoder({}, 3);
    obj._midCoder[posState] = bitTreeEncoder({}, 3);
  }
  return obj;
}
function $Init_2(obj, numPosStates) {
  InitBitModels(obj._choice);
  for (let posState = 0; posState < numPosStates; ++posState) {
    InitBitModels(obj._lowCoder[posState].Models);
    InitBitModels(obj._midCoder[posState].Models);
  }
  InitBitModels(obj._highCoder.Models);
}
function $SetPrices(obj, posState, numSymbols, prices, st) {
  var a0, a1, b0, b1, i;
  a0 = ProbPrices[obj._choice[0] >>> 2];
  a1 = ProbPrices[2048 - obj._choice[0] >>> 2];
  b0 = a1 + ProbPrices[obj._choice[1] >>> 2];
  b1 = a1 + ProbPrices[2048 - obj._choice[1] >>> 2];
  i = 0;
  for (i = 0; i < 8; ++i) {
    if (i >= numSymbols) {
      return;
    }
    prices[st + i] = a0 + $GetPrice_1(obj._lowCoder[posState], i);
  }
  for (; i < 16; ++i) {
    if (i >= numSymbols) {
      return;
    }
    prices[st + i] = b0 + $GetPrice_1(obj._midCoder[posState], i - 8);
  }
  for (; i < numSymbols; ++i) {
    prices[st + i] = b1 + $GetPrice_1(obj._highCoder, i - 8 - 8);
  }
}
function $Encode_0(obj, rangeEncoder, symbol, posState) {
  $Encode(obj, rangeEncoder, symbol, posState);
  if ((obj._counters[posState] -= 1) == 0) {
    $SetPrices(
      obj,
      posState,
      obj._tableSize,
      obj._prices,
      posState * 272
    );
    obj._counters[posState] = obj._tableSize;
  }
}
function $Encoder$LenPriceTableEncoder(obj) {
  $Encoder$LenEncoder(obj);
  obj._prices = [];
  obj._counters = [];
  return obj;
}
function $GetPrice(obj, symbol, posState) {
  return obj._prices[posState * 272 + symbol];
}
function $UpdateTables(obj, numPosStates) {
  for (let posState = 0; posState < numPosStates; ++posState) {
    $SetPrices(
      obj,
      posState,
      obj._tableSize,
      obj._prices,
      posState * 272
    );
    obj._counters[posState] = obj._tableSize;
  }
}
function $Create_1(obj, numPosBits, numPrevBits) {
  var i, numStates;
  if (obj.m_Coders != null && obj.m_NumPrevBits == numPrevBits && obj.m_NumPosBits == numPosBits) {
    return;
  }
  obj.m_NumPosBits = numPosBits;
  obj.m_PosMask = (1 << numPosBits) - 1;
  obj.m_NumPrevBits = numPrevBits;
  numStates = 1 << obj.m_NumPrevBits + obj.m_NumPosBits;
  obj.m_Coders = initArr(numStates);
  for (i = 0; i < numStates; ++i) {
    obj.m_Coders[i] = $Encoder$LiteralEncoder$Encoder2({});
  }
}
function $GetSubCoder(obj, pos, prevByte) {
  return obj.m_Coders[((pos & obj.m_PosMask) << obj.m_NumPrevBits) + ((prevByte & 255) >>> 8 - obj.m_NumPrevBits)];
}
function $Init_3(obj) {
  var i, numStates = 1 << obj.m_NumPrevBits + obj.m_NumPosBits;
  for (i = 0; i < numStates; ++i) {
    InitBitModels(obj.m_Coders[i].m_Encoders);
  }
}
function $Encode_1(obj, rangeEncoder, symbol) {
  var bit, context = 1;
  for (let i = 7; i >= 0; --i) {
    bit = symbol >> i & 1;
    $Encode_3(rangeEncoder, obj.m_Encoders, context, bit);
    context = context << 1 | bit;
  }
}
function $EncodeMatched(obj, rangeEncoder, matchByte, symbol) {
  var bit, matchBit, state, same = true, context = 1;
  for (let i = 7; i >= 0; --i) {
    bit = symbol >> i & 1;
    state = context;
    if (same) {
      matchBit = matchByte >> i & 1;
      state += 1 + matchBit << 8;
      same = matchBit === bit;
    }
    $Encode_3(rangeEncoder, obj.m_Encoders, state, bit);
    context = context << 1 | bit;
  }
}
function $Encoder$LiteralEncoder$Encoder2(obj) {
  obj.m_Encoders = initArr(768);
  return obj;
}
function $GetPrice_0(obj, matchMode, matchByte, symbol) {
  var bit, context = 1, i = 7, matchBit, price = 0;
  if (matchMode) {
    for (; i >= 0; --i) {
      matchBit = matchByte >> i & 1;
      bit = symbol >> i & 1;
      price += GetPrice(
        obj.m_Encoders[(1 + matchBit << 8) + context],
        bit
      );
      context = context << 1 | bit;
      if (matchBit != bit) {
        ;
        --i;
        break;
      }
    }
  }
  for (; i >= 0; --i) {
    bit = symbol >> i & 1;
    price += GetPrice(obj.m_Encoders[context], bit);
    context = context << 1 | bit;
  }
  return price;
}
function $MakeAsChar(obj) {
  obj.BackPrev = -1;
  obj.Prev1IsChar = 0;
}
function $MakeAsShortRep(obj) {
  obj.BackPrev = 0;
  obj.Prev1IsChar = 0;
}
function $BitTreeDecoder(obj, numBitLevels) {
  obj.NumBitLevels = numBitLevels;
  obj.Models = initArr(1 << numBitLevels);
  return obj;
}
function $Decode_0(obj, rangeDecoder) {
  var bitIndex, m = 1;
  for (bitIndex = obj.NumBitLevels; bitIndex != 0; bitIndex -= 1) {
    m = (m << 1) + decodeBit(rangeDecoder, obj.Models, m);
  }
  return m - (1 << obj.NumBitLevels);
}
function $ReverseDecode(obj, rangeDecoder) {
  let symbol = 0;
  for (let m = 1, bitIndex = 0, bit; bitIndex < obj.NumBitLevels; ++bitIndex) {
    bit = decodeBit(rangeDecoder, obj.Models, m);
    m <<= 1;
    m += bit;
    symbol |= bit << bitIndex;
  }
  return symbol;
}
function reverseDecode(Models, startIndex, rangeDecoder, NumBitLevels) {
  let symbol = 0;
  for (let bitIndex = 0, m = 1, bit; bitIndex < NumBitLevels; ++bitIndex) {
    bit = decodeBit(rangeDecoder, Models, startIndex + m);
    m <<= 1;
    m += bit;
    symbol |= bit << bitIndex;
  }
  return symbol;
}
function bitTreeEncoder(obj, numBitLevels) {
  obj.NumBitLevels = numBitLevels;
  obj.Models = initArr(1 << numBitLevels);
  return obj;
}
function $Encode_2(obj, rangeEncoder, symbol) {
  var bit, bitIndex, m = 1;
  for (bitIndex = obj.NumBitLevels; bitIndex != 0; ) {
    bitIndex -= 1;
    bit = symbol >>> bitIndex & 1;
    $Encode_3(rangeEncoder, obj.Models, m, bit);
    m = m << 1 | bit;
  }
}
function $GetPrice_1(obj, symbol) {
  var bit, bitIndex, m = 1, price = 0;
  for (bitIndex = obj.NumBitLevels; bitIndex != 0; ) {
    bitIndex -= 1;
    bit = symbol >>> bitIndex & 1;
    price += GetPrice(obj.Models[m], bit);
    m = (m << 1) + bit;
  }
  return price;
}
function $ReverseEncode(obj, rangeEncoder, symbol) {
  var bit, m = 1;
  for (let i = 0; i < obj.NumBitLevels; ++i) {
    bit = symbol & 1;
    $Encode_3(rangeEncoder, obj.Models, m, bit);
    m = m << 1 | bit;
    symbol >>= 1;
  }
}
function $ReverseGetPrice(obj, symbol) {
  var bit, m = 1, price = 0;
  for (let i = obj.NumBitLevels; i != 0; i -= 1) {
    bit = symbol & 1;
    symbol >>>= 1;
    price += GetPrice(obj.Models[m], bit);
    m = m << 1 | bit;
  }
  return price;
}
function ReverseEncode(Models, startIndex, rangeEncoder, NumBitLevels, symbol) {
  var bit, m = 1;
  for (let i = 0; i < NumBitLevels; ++i) {
    bit = symbol & 1;
    $Encode_3(rangeEncoder, Models, startIndex + m, bit);
    m = m << 1 | bit;
    symbol >>= 1;
  }
}
function ReverseGetPrice(Models, startIndex, NumBitLevels, symbol) {
  var bit, m = 1, price = 0;
  for (let i = NumBitLevels; i != 0; i -= 1) {
    bit = symbol & 1;
    symbol >>>= 1;
    price += ProbPrices[((Models[startIndex + m] - bit ^ -bit) & 2047) >>> 2];
    m = m << 1 | bit;
  }
  return price;
}
function decodeBit(obj, probs, index) {
  var newBound, prob = probs[index];
  newBound = (obj.Range >>> 11) * prob;
  if ((obj.Code ^ MIN_INT32) < (newBound ^ MIN_INT32)) {
    obj.Range = newBound;
    probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
    if (!(obj.Range & -16777216)) {
      obj.Code = obj.Code << 8 | $read(obj.Stream);
      obj.Range <<= 8;
    }
    return 0;
  } else {
    obj.Range -= newBound;
    obj.Code -= newBound;
    probs[index] = prob - (prob >>> 5) << 16 >> 16;
    if (!(obj.Range & -16777216)) {
      obj.Code = obj.Code << 8 | $read(obj.Stream);
      obj.Range <<= 8;
    }
    return 1;
  }
}
function $DecodeDirectBits(obj, numTotalBits) {
  let result = 0;
  for (let i = numTotalBits; i != 0; i -= 1) {
    obj.Range >>>= 1;
    let t = obj.Code - obj.Range >>> 31;
    obj.Code -= obj.Range & t - 1;
    result = result << 1 | 1 - t;
    if (!(obj.Range & -16777216)) {
      obj.Code = obj.Code << 8 | $read(obj.Stream);
      obj.Range <<= 8;
    }
  }
  return result;
}
function $Init_8(obj) {
  obj.Code = 0;
  obj.Range = -1;
  for (let i = 0; i < 5; ++i) {
    obj.Code = obj.Code << 8 | $read(obj.Stream);
  }
}
function InitBitModels(probs) {
  for (let i = probs.length - 1; i >= 0; --i) {
    probs[i] = 1024;
  }
}
const ProbPrices = function() {
  var end, i, j, start, ProbPrices2 = [];
  for (i = 8; i >= 0; --i) {
    start = 1;
    start <<= 9 - i - 1;
    end = 1;
    end <<= 9 - i;
    for (j = start; j < end; ++j) {
      ProbPrices2[j] = (i << 6) + (end - j << 6 >>> 9 - i - 1);
    }
  }
  return ProbPrices2;
}();
function $Encode_3(obj, probs, index, symbol) {
  var newBound, prob = probs[index];
  newBound = (obj.Range >>> 11) * prob;
  if (!symbol) {
    obj.Range = newBound;
    probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
  } else {
    obj.Low = add(
      obj.Low,
      and(fromInt(newBound), [4294967295, 0])
    );
    obj.Range -= newBound;
    probs[index] = prob - (prob >>> 5) << 16 >> 16;
  }
  if (!(obj.Range & -16777216)) {
    obj.Range <<= 8;
    $ShiftLow(obj);
  }
}
function $EncodeDirectBits(obj, v, numTotalBits) {
  for (let i = numTotalBits - 1; i >= 0; i -= 1) {
    obj.Range >>>= 1;
    if ((v >>> i & 1) == 1) {
      obj.Low = add(obj.Low, fromInt(obj.Range));
    }
    if (!(obj.Range & -16777216)) {
      obj.Range <<= 8;
      $ShiftLow(obj);
    }
  }
}
function $GetProcessedSizeAdd(obj) {
  return add(add(fromInt(obj._cacheSize), obj._position), [4, 0]);
}
function $Init_9(obj) {
  obj._position = P0_longLit;
  obj.Low = P0_longLit;
  obj.Range = -1;
  obj._cacheSize = 1;
  obj._cache = 0;
}
function $ShiftLow(obj) {
  const LowHi = lowBits_0(shru(obj.Low, 32));
  if (LowHi != 0 || compare(obj.Low, [4278190080, 0]) < 0) {
    obj._position = add(
      obj._position,
      fromInt(obj._cacheSize)
    );
    let temp = obj._cache;
    do {
      $write(obj.Stream, temp + LowHi);
      temp = 255;
    } while ((obj._cacheSize -= 1) != 0);
    obj._cache = lowBits_0(obj.Low) >>> 24;
  }
  obj._cacheSize += 1;
  obj.Low = shl(and(obj.Low, [16777215, 0]), 8);
}
function GetPrice(Prob, symbol) {
  return ProbPrices[((Prob - symbol ^ -symbol) & 2047) >>> 2];
}
function decode(utf) {
  let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];
  for (let i = 0; i < l; ++i, ++j) {
    x = utf[i] & 255;
    if (!(x & 128)) {
      if (!x) {
        return utf;
      }
      charCodes[j] = x;
    } else if ((x & 224) == 192) {
      if (i + 1 >= l) {
        return utf;
      }
      y = utf[++i] & 255;
      if ((y & 192) != 128) {
        return utf;
      }
      charCodes[j] = (x & 31) << 6 | y & 63;
    } else if ((x & 240) == 224) {
      if (i + 2 >= l) {
        return utf;
      }
      y = utf[++i] & 255;
      if ((y & 192) != 128) {
        return utf;
      }
      z = utf[++i] & 255;
      if ((z & 192) != 128) {
        return utf;
      }
      charCodes[j] = (x & 15) << 12 | (y & 63) << 6 | z & 63;
    } else {
      return utf;
    }
    if (j == 16383) {
      buf.push(String.fromCharCode.apply(String, charCodes));
      j = -1;
    }
  }
  if (j > 0) {
    charCodes.length = j;
    buf.push(String.fromCharCode.apply(String, charCodes));
  }
  return buf.join("");
}
function encode(s) {
  let ch, chars = [], elen = 0, l = s.length;
  if (typeof s == "object") {
    return s;
  } else {
    $getChars(s, 0, l, chars, 0);
  }
  for (let i = 0; i < l; ++i) {
    ch = chars[i];
    if (ch >= 1 && ch <= 127) {
      ;
      ++elen;
    } else if (!ch || ch >= 128 && ch <= 2047) {
      elen += 2;
    } else {
      elen += 3;
    }
  }
  const data = [];
  elen = 0;
  for (let i = 0; i < l; ++i) {
    ch = chars[i];
    if (ch >= 1 && ch <= 127) {
      data[elen++] = ch << 24 >> 24;
    } else if (!ch || ch >= 128 && ch <= 2047) {
      data[elen++] = (192 | ch >> 6 & 31) << 24 >> 24;
      data[elen++] = (128 | ch & 63) << 24 >> 24;
    } else {
      data[elen++] = (224 | ch >> 12 & 15) << 24 >> 24;
      data[elen++] = (128 | ch >> 6 & 63) << 24 >> 24;
      data[elen++] = (128 | ch & 63) << 24 >> 24;
    }
  }
  return data;
}
const ModeMap = {
  1: { s: 16, f: 64, m: 0 },
  2: { s: 20, f: 64, m: 0 },
  3: { s: 19, f: 64, m: 1 },
  4: { s: 20, f: 64, m: 1 },
  5: { s: 21, f: 128, m: 1 },
  6: { s: 22, f: 128, m: 1 },
  7: { s: 23, f: 128, m: 1 },
  8: { s: 24, f: 255, m: 1 },
  9: { s: 25, f: 255, m: 1 }
};
function compress(data, mode = 5) {
  const obj = {
    c: $LZMAByteArrayCompressor(
      {},
      encode(data),
      ModeMap[mode]
    )
  };
  while ($processChunkEncode(obj.c.chunker))
    ;
  return new Int8Array($toByteArray(obj.c.output));
}
function decompress(bytearray) {
  const obj = {
    d: $LZMAByteArrayDecompressor({}, bytearray)
  };
  while ($processChunkDecode(obj.d.chunker)) {
  }
  const decoded = decode($toByteArray(obj.d.output));
  if (decoded instanceof Array) {
    return new Int8Array(decoded);
  }
  return decoded;
}
