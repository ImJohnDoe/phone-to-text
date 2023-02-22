const Transform = require('stream').Transform;

class TwilioWavFileBuilder {
    static SAMPLE_RATE = 8000;
    /**
     * @param {Function} onConnected - the function to call when a new call connects
     */
    constructor(onConnected, printDebug = false) {
        this._printDebug = printDebug;
        /**
         * @type {Function} onConnected - the function to call when a new call connects
         */
        this.onConnected = onConnected;
    }

    alive = false;

    get durationInSeconds() {
        // 2 bytes per sample
        return this._encoded.length / (TwilioWavFileBuilder.SAMPLE_RATE * 2);
    }

    get connectionIsAlive() {
        return this._encoded.length > 0;
    }

    popFile() {
        const encodedFile = this._getEncodedFile();
        this._newfile();
        this._printDebug ? console.log('file popped from buffer') : null;
        return encodedFile;
    }

    chunkTwilioIntoWavChunks() {
        this._printDebug ? console.log('initializing TwilioWavFileBuilder stream...') : null;
        let receivedFirstMedia = false;
        return new Transform({
            transform: (chunk, encoding, callback) => {
                const msg = JSON.parse(chunk.toString('utf8'));

                switch (msg.event) {
                    case "connected":
                        this._printDebug ? console.log("A new call has connected") : null;
                        this._newfile();
                        this.alive = true;
                        this.onConnected();
                        return callback();
                    case "media":
                        receivedFirstMedia && this._printDebug ? console.log("Receiving audio...") : null;
                        this._onMedia(msg.media.payload);
                        return callback();
                    case "stop":
                        this._printDebug ? console.log("Call has ended") : null;
                        this.alive = false;
                        return callback();
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

        return file;
    }

    _newfile() {
        this._encoded = Buffer.from([]);
    }

    _onMedia(mediaPayload) {
        this._encoded = Buffer.concat([this._encoded, Buffer.from(mediaPayload, "base64")]);
    }

    static _wavHeaderNoLen = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x62, 0xb8, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 0x12, 0x00, 0x00, 0x00, 0x07, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x66, 0x61, 0x63, 0x74, 0x04, 0x00, 0x00, 0x00, 0xc5, 0x5b, 0x00, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
    ]);
}

exports.TwilioWavFileBuilder = TwilioWavFileBuilder;
