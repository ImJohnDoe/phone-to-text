require('dotenv').config();
const express = require('express');
const expressWebSocket = require('express-ws');
const websocketStream = require('websocket-stream/stream');

const { TwilioWavFileBuilder } = require("./TwilioWavFileBuilder.js");
const { NlpCloudTranscriber } = require("./NlpCloudTranscriber.js");

const PORT = 8080;
const printDebug = true;
const nlpCloundToken = process.env.NLP_CLOUD_TOKEN;
const COUNT_WORKERS = 4;
const MINIMUM_AUDIO_LENGTH = 0.5;

const app = express();

// extend express app with app.ws()
expressWebSocket(app, null, {
    perMessageDeflate: false,
});

app.ws("/media", (ws, req) => {
    // Wrap the websocket in a Node stream
    const mediaStream = websocketStream(ws);

    printDebug ? console.log('New WebSocket connection') : null;

    const nlpTranscriber = new NlpCloudTranscriber(nlpCloundToken, printDebug);
    const wavBuilder = new TwilioWavFileBuilder(() => {
        printDebug ? console.log('On Connected') : null;
        /**
         * @type {Array<Promise>} workers - the array of promises that are currently working
         */
        let workers = [];
        let assignWork = () => {
            if (!wavBuilder.alive) {
                return;
            }
            console.log(`workers.length: ${workers.length}`);
            if (workers.length < COUNT_WORKERS && wavBuilder.durationInSeconds > MINIMUM_AUDIO_LENGTH) {
                const file = wavBuilder.popFile();
                const worker = {
                    promise: nlpTranscriber.transcribeFile(file)
                }
                worker.promise.then((result) => {
                    printDebug ? console.log(`[RESULT]: ${result}`) : null;
                    workers = workers.filter(w => w !== worker);
                })
                workers.push(worker);
            }
            setTimeout(assignWork, 500);
        }
        setTimeout(assignWork, 500);
    }, printDebug);

    mediaStream
        .pipe(wavBuilder.chunkTwilioIntoWavChunks())
        .on('data', msg => {
            printDebug ? console.log(`[GOT MSG]: ${msg}`) : null;
        });
});

console.log(`Listening for Twilio Voice Media WebSocket Connections on port ${PORT}`);
app.listen(PORT);


