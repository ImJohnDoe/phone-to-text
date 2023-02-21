require('dotenv').config()
const express = require('express');
const expressWebSocket = require('express-ws');
const websocketStream = require('websocket-stream/stream');
const Transform = require('stream').Transform;
const NLPCloudClient = require('nlpcloud');

const PORT = 8080;
const nlpCloundToken = process.env.NLP_CLOUD_TOKEN;

const app = express();

// extend express app with app.ws()
expressWebSocket(app, null, {
    perMessageDeflate: false,
});

/**
 * This is the endpoint that Twilio will send the media to.
 * This endpoint will be called when a call is connected and will be called for each chunk of media that is sent.
 * To wire this up add a TwiML app to your Twilio account and set the Voice URL to this endpoint.
 * 
 * https://console.twilio.com/us1/develop/twiml-bins/twiml-bins
 * example of a TwiML app:
 * <?xml version="1.0" encoding="UTF-8"?>
 * <Response>
 * <Start>
 *     <Stream url="wss://****-**-**-**-****.ngrok.io/media" />
 * </Start>
 * <Say>
 *     Connected to Socket, about to wait for a bit.
 * </Say>
 * <Pause length="20" />
 * <Say>
 *     All done waiting. Good bye.
 * </Say>
 * </Response>
 * 
 * After you have created the TwiML app, you can use it in a Twilio phone number.
 * https://www.twilio.com/console/phone-numbers/incoming
 * 
 * Set the TwiML app to run when a call comes in.
 */
app.ws("/media", (ws, req) => {
    // Wrap the websocket in a Node stream
    const mediaStream = websocketStream(ws);

    console.log('New WebSocket connection');

    const wavBuilder = new TwilioWavFileBuilder();
    const nlpTranscriber = new NLPTranscriber();

    mediaStream
        .pipe(wavBuilder.chunkTwilioIntoWavChunks())
        .pipe(nlpTranscriber.transcribeStream(wavBuilder.onRejectChunk.bind(wavBuilder)))
        .on('data', msg => {
            console.log(`[GOT MSG]: ${msg}`);
        });
});

console.log(`Listening for Twilio Voice Media WebSocket Connections on port ${PORT}`);
app.listen(PORT);

class NLPTranscriber {
    /**
     * @param {Function} rejectChunk - a function that will be called when a chunk is rejected. This function will be passed
     * the chunk that was rejected.
     */
    constructor(rejectChunk) {
        this.nlpClient = new NLPCloudClient('whisper', nlpCloundToken, true)
        this.rejectChunk = rejectChunk;
    }

    /**
     * Expects to have a Node stream piped to it that contains encoded audio files.
     * @returns {Transform} a Node stream that can be piped to 
     */
    transcribeStream() {
        return new Transform({
            transform: (chunk, encoding, callback) => {
                if (Buffer.isBuffer(chunk)) {
                    this._onChunk(chunk)
                        .then(data => {
                            callback(undefined, data);
                        }).catch(err => {
                            callback(err);
                        });
                } else {
                    console.error(`[ERROR]: Got a non-buffer chunk: ${chunk}`);
                    callback(undefined, '[DID NOT GET BUFFER]');
                }
            }
        });
    }

    /**
     * @param {Buffer} buffer - the encoded audio file. This should be a valid audio file such as a WAV file.
     * with a valid header followed by the audio data.
     */
    async _onChunk(buffer) {
        const msg = buffer.toString('base64');

        let data = '[NO DATA]]';
        try {

         data = await this.nlpClient.asr(null, msg, 'en').then((response) => {
                if (typeof response.data === 'object' && response.data.text) {
                    return response.data.text;
                } else {
                    return '[NO DATA] - probably silence';
                }
            })
                .catch((err) => {
                    console.error(err.response.status);
                    console.error(err.response.data.detail);
                    if (err.response.status === 429 && this.rejectChunk) {
                        this.rejectChunk(buffer);
                        return '[TOO NOISY] - chunk rejected';
                    }
                });
        } catch (err) {
            console.error(`[ERROR]: ${err}`);
        }
        return data;
    }
}

class TwilioWavFileBuilder {
    static SAMPLE_RATE = 8000;
    constructor() {
        this._encoded = Buffer.from([]);
        this._rejected = Buffer.from([]);
    }

    static _wavHeaderNoLen = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x62, 0xb8, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 0x12, 0x00, 0x00, 0x00, 0x07, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x04, 0x00, 0x00, 0x00, 0x66, 0x61, 0x63, 0x74, 0x04, 0x00, 0x00, 0x00, 0xc5, 0x5b, 0x00, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
    ]);

    chunkTwilioIntoWavChunks() {
        return new Transform({
            transform: (chunk, encoding, callback) => {
                const msg = JSON.parse(chunk.toString('utf8'));

                /**
                 * @type {NodeJS.Timer}
                 */
                let silenceTimer;
                let silenceCheckDebounce = false;

                switch (msg.event) {
                    case "connected":
                        console.log("A new call has connected");
                        silenceTimer = setInterval(() => {
                            silenceCheckDebounce = false;
                        }, 1000);
                        return callback();
                    case "media":
                        // console.log("Receiving audio...");
                        this._onMedia(msg.media.payload);

                        let isSilent = false;
                        // if (!silenceCheckDebounce) {
                        //     silenceCheckDebounce = true;
                        //     isSilent = this._isSilenceOrNoiseForNSeconds(2);
                        // }
                        if (
                            //this._isSilenceOrNoiseForNSeconds(2) || 
                            this._isAtLeastNSecondsLong(1)) {
                            const encodedFile = this._getEncodedFile();
                            this._newfile();
                            callback(undefined, encodedFile);
                        } else {
                            callback();
                        }
                        return;
                    case "stop":
                        console.log("Call has ended");
                        const encodedFile = this._getEncodedFile();
                        this._newfile();
                        callback(undefined, encodedFile);
                        clearInterval(silenceTimer);
                        return;
                    case "disconnect":
                        console.log("Call has disconnected");

                    default:
                        return callback();
                }
            },
        });
    }

    /**
     * @param {Buffer} chunk - the chunk of audio data to check
     * @return {void}
     */
    onRejectChunk(chunk) {
        // prepend the chunk to the encoded file so that it can be transcribed again
        this._rejected = Buffer.concat([chunk, this._rejected]);

        console.log("going to reprocess the last chunk");
    }

    _getWavHeaderLength() {
        let count = this._encoded.length + this._rejected.length;
        return Buffer.from([count % 256, (count >> 8) % 256, (count >> 16) % 256, (count >> 24) % 256]);
    }

    _getEncodedFile() {
        if (this._encoded.length === 0) {
            return Buffer.from([]);
        }
        const file = Buffer.concat([
            TwilioWavFileBuilder._wavHeaderNoLen,
            this._getWavHeaderLength(),
            this._rejected,
            this._encoded
        ]);

        console.log(file.byteLength);
        return file;
    }

    _newfile() {
        this._encoded = Buffer.from([]);
        this._rejected = Buffer.concat([this._rejected, this._encoded]);
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

    /**
     * @param {number} n - the number of seconds to check for
     * @returns {boolean} true if the encoded audio file is at least n seconds long and is silent
     */
    _isSilenceOrNoiseForNSeconds(n) {
        if (!this._isAtLeastNSecondsLong(n)) {
            return false;
        }
        let buffer = this._encoded.subarray(n * TwilioWavFileBuilder.SAMPLE_RATE);
        const rms = this._calculateRMSAmplitude(buffer);
        console.log(rms > 10000 ? "NOISE" : rms < 9000 ? "SILENCE" : rms.toPrecision(2));
        return rms < 9000;
    }

    /**
     * @param {Buffer} buffer 
     * @returns {number} the RMS amplitude of the buffer
     */
    _calculateRMSAmplitude(buffer) {
        let sumSquared = 0;
        let numSamples = 0;

        for (let i = 0; i < buffer.length; i += 2) {
            const sample = buffer.readInt16BE(i);
            sumSquared += sample * sample;
            numSamples++;
        }

        const rms = Math.sqrt(sumSquared / numSamples);

        return rms;
    }
}
