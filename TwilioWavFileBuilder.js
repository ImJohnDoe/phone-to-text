const Transform = require('stream').Transform;

class TwilioWavFileBuilder {
    static SAMPLE_RATE = 8000;
    constructor() {
        this._encoded = Buffer.from([]);
    }

    static _wavHeaderNoLen = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x62, 0xb8, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 0x12, 0x00, 0x00, 0x00, 0x07, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x66, 0x61, 0x63, 0x74, 0x04, 0x00, 0x00, 0x00, 0xc5, 0x5b, 0x00, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
    ]);

    chunkTwilioIntoWavChunks() {
        console.log('initializing TwilioWavFileBuilder stream...')
        return new Transform({
            transform: (chunk, encoding, callback) => {
                const msg = JSON.parse(chunk.toString('utf8'));

                switch (msg.event) {
                    case "connected":
                        console.log("A new call has connected");
                        return callback();
                    case "media":
                        // console.log("Receiving audio...");
                        this._onMedia(msg.media.payload);

                        if (this._isAtLeastNSecondsLong(3)) {
                            const encodedFile = this._getEncodedFile();
                            this._newfile();
                            console.log('sending file down pipe - at least 3 seconds long');
                            callback(undefined, encodedFile);
                        } else {
                            callback();
                        }
                        return;
                    case "stop":
                        console.log("Call has ended");
                        const encodedFile = this._getEncodedFile();
                        this._newfile();
                        console.log('sending file down pipe - call ended');
                        callback(undefined, encodedFile);
                        return;
                    default:
                        return callback();
                }
            },
        });
    }

    _getWavHeaderLength() {
        let count = this._encoded.length;
        return Buffer.from([count % 256, (count >> 8) % 256, (count >> 16) % 256, (count >> 24) % 256]);
    }

    _getEncodedFile() {
        if (this._encoded.length === 0) {
            return Buffer.from([]);
        }
        const file = Buffer.concat([
            TwilioWavFileBuilder._wavHeaderNoLen,
            this._getWavHeaderLength(),
            this._encoded
        ]);

        console.log(file.byteLength);
        return file;
    }

    _newfile() {
        this._encoded = Buffer.from([]);
    }

    _onMedia(mediaPayload) {
        this._encoded = Buffer.concat([this._encoded, Buffer.from(mediaPayload, "base64")]);
    }

    /**
     * @param {number} n - the number of seconds to check for
     * @returns {boolean} true if the encoded audio file is at least n seconds long
     */
    _isAtLeastNSecondsLong(n) {
        return this._encoded.length > n * TwilioWavFileBuilder.SAMPLE_RATE;
    }
}

exports.TwilioWavFileBuilder = TwilioWavFileBuilder;
