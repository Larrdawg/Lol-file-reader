var BufferCursor = require("buffercursor");

function inibinToObject(buffer) {
    buffer = new BufferCursor(buffer);

    var version = buffer.readUInt8();
    var stringTableOffset = buffer.readUInt16LE();
    var bitmask = buffer.readUInt16LE();

    console.assert(version == 2, "Invalid INIBIN FILE!");

    var ret = {};
    var len = buffer.readUInt16LE();

    if (bitmask & 0x0001) {
        ret = parseUInt32(len, buffer, ret);
    }

    if (bitmask & 0x0002) {
        ret = parseFloats(len, buffer, ret);
    }

    if (bitmask & 0x0004) {
        ret = parseUInt10(len, buffer, ret);
    }

    if (bitmask & 0x0008) {
        ret = parseUInt16(len, buffer, ret);
    }

    if (bitmask & 0x0010) {
        ret = parseUInt8(len, buffer, ret);
    }

    if (bitmask & 0x0020) {
        ret = parseBools(len, buffer, ret);
    }

    if (bitmask & 0x0040) {
        buffer.seek(buffer.tell() + (7 * len));
    }

    if (bitmask & 0x0080) {
        buffer.seek(buffer.tell() + (16 * len));
    }

    if (bitmask & 0x0100) {
        ret = parseUInt16(len, buffer, ret);
    }

    if (bitmask & 0x0200) {
        buffer.seek(buffer.tell() + (12 * len));
    }

    if (bitmask & 0x0400) {
        ret = parseUInt32(len, buffer, ret);
    }

    if (bitmask & 0x0800) {
        buffer.seek(buffer.tell() + (20 * len));
    }

    if (bitmask & 0x1000) {
        ret = parseStrings(len, buffer, ret, stringTableOffset);
    }

    return ret;
}

function readKeys(len, buffer) {
    var ret = [];
    for (var i = 0; i < len; ++i) {
        ret.push(buffer.readUInt32LE());
    }
    return ret;
}

function parseUInt32(len, buf, ret) {
    readKeys(len, buf).forEach(function(key) {
        ret[key] = buf.readUInt32LE();
    });
    return ret;
}

function parseFloats(len, buf, ret) {
    readKeys(len, buf).forEach(function(key) {
        ret[key] = buf.readFloatLE();
    });
    return ret;
}

function parseUInt10(len, buf, ret) {
    readKeys(len, buf).forEach(function(key) {
        ret[key] = buf.readUInt8() * 0.1;
    });
    return ret;
}

function parseUInt16(len, buf, ret) {
    readKeys(len, buf).forEach(function(key) {
        ret[key] = buf.readUInt16LE();
    });
    return ret;
}

function parseUInt8(len, buf, ret) {
    readKeys(len, buf).forEach(function(key) {
        ret[key] = buf.readUInt8();
    });
    return ret;
}

function parseBools(len, buf, ret) {
    var bool;
    readKeys(len, buf).forEach(function(key, index) {
        if (index % 8 === 0) {
            bool = buf.readUInt8();
        } else {
            bool = bool >> 1;
        }
        ret[key] = !!(bool & 0x01);
    });
    return ret;
}

function parseStrings(len, buf, ret, stringTableOffset) {
    var keys = readKeys(len, buf);
    keys.forEach(function(key, index) {
        var strOffset = buf.readUInt16LE();
        var pos = buf.tell();
        buf.seek(stringTableOffset + strOffset - 2);

        var bytes = [];
        while (true) {
            var bit = buf.readUInt8();
            if (bit === 0x00) break;
            bytes.push(bit);
        }

        ret[key] = new Buffer(bytes).toString('ascii');
        buf.seek(pos);
    });
    return ret;
}

/*uint32 i = 1;
      for(uint32 key : keys) {
         Value value;
  
         uint16 offset;
         
         buffer >> offset;
         value.stringV = reinterpret_cast<const char*>(&buffer.getBytes()[offset+keys.size()*2-i*2]);
         
         values[key] = value;
         ++i;
      }*/

module.exports.inibinToObject = inibinToObject;